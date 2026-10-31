//pick her mood from the last 24 hours of github contributions.
//
//a rolling window rather than the contribution calendar, because the calendar's days would make
//"asleep" start anywhere from a few hours to two days after the last contribution.
const LOGIN = "faetalize";
const FRANTIC_AT = 25;

export async function pickMood(token) {
  const now = new Date();
  const from = new Date(now - 24 * 60 * 60 * 1000);

  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
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
  return { mood: total === 0 ? "asleep" : total >= FRANTIC_AT ? "frantic" : "awake", total };
}
