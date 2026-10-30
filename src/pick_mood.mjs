#!/usr/bin/env node
//render dist/current.svg in the mood that matches the last 24 hours of github contributions.
//
//a rolling window rather than the contribution calendar, because the calendar's days would make
//"asleep" start anywhere from a few hours to two days after the last contribution.
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const LOGIN = "faetalize";
const FRANTIC_AT = 25;

const now = new Date();
const from = new Date(now - 24 * 60 * 60 * 1000);

const response = await fetch("https://api.github.com/graphql", {
  method: "POST",
  headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` },
  body: JSON.stringify({
    query: `query ($login: String!, $from: DateTime!, $to: DateTime!) {
      user(login: $login) {
        contributionsCollection(from: $from, to: $to) {
          totalCommitContributions
          totalIssueContributions
          totalPullRequestContributions
          totalPullRequestReviewContributions
          totalRepositoryContributions
          restrictedContributionsCount
        }
      }
    }`,
    variables: { login: LOGIN, from: from.toISOString(), to: now.toISOString() },
  }),
});
const { data, errors } = await response.json();
if (errors) throw new Error(JSON.stringify(errors));

const total = Object.values(data.user.contributionsCollection).reduce((sum, n) => sum + n, 0);
const mood = total === 0 ? "asleep" : total >= FRANTIC_AT ? "frantic" : "awake";

const path = (relative) => fileURLToPath(new URL(relative, import.meta.url));
mkdirSync(path("../dist"), { recursive: true });
execFileSync("node", [path("./render.mjs"), mood, path("../dist/current.svg")], {
  env: { ...process.env, FAIRY_COUNT: String(total) },
});
console.log(`${total} contributions in 24 hours: ${mood}`);
