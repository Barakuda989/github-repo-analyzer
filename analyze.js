#!/usr/bin/env node

const axios = require("axios");
const chalk = require("chalk").default;
const ora = require("ora").default;
const boxen = require("boxen").default;
const Table = require("cli-table3");
const gradient = require("gradient-string");

function renderLanguageChart(languages) {

    const total = Object.values(languages).reduce((a, b) => a + b, 0);

    let result = "\nLanguages:\n";

    for (const lang in languages) {

        const percentValue = (languages[lang] / total) * 100;
        const percent = percentValue.toFixed(1);

        const bars = Math.max(1, Math.round(percentValue / 5));

        const bar = "█".repeat(bars);

        result += `${chalk.cyan(lang.padEnd(12))} ${bar} ${percent}%\n`;
    }

    return result;
}

function renderCommitGraph(data) {

    if (!Array.isArray(data) || data.length === 0) return "";

    const lastWeeks = data.slice(-10);

    const max = Math.max(...lastWeeks.map(w => w.total));

    const maxBar = 30;

    let result = "\nCommit Activity:\n";

    lastWeeks.forEach((week, i) => {

        const bars = max === 0 ? 1 : Math.max(1, Math.round((week.total / max) * maxBar));

        const bar = "█".repeat(bars);

        result += `Week ${String(i + 1).padEnd(2)} ${bar} ${week.total}\n`;
    });

    return result;
}

async function analyzeRepo(repo) {

    if (!repo || !repo.includes("/")) {
        console.log(chalk.red("Format phải là owner/repo"));
        process.exit(1);
    }

    const spinner = ora("Fetching GitHub data...").start();

    try {

        const repoRes = await axios.get(`https://api.github.com/repos/${repo}`);

        const data = repoRes.data;

        let contributors = 0;
        let releases = 0;
        let languages = {};
        let commitActivity = [];

        try {
            const c = await axios.get(`https://api.github.com/repos/${repo}/contributors`);
            contributors = c.data.length;
        } catch {}

        try {
            const r = await axios.get(`https://api.github.com/repos/${repo}/releases`);
            releases = r.data.length;
        } catch {}

        try {
            const l = await axios.get(`https://api.github.com/repos/${repo}/languages`);
            languages = l.data;
        } catch {}

        for (let i = 0; i < 6; i++) {

            try {

                const a = await axios.get(
                    `https://api.github.com/repos/${repo}/stats/commit_activity`,
                    { validateStatus: () => true }
                );

                if (a.status === 200 && Array.isArray(a.data)) {
                    commitActivity = a.data;
                    break;
                }

            } catch {}

            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        spinner.stop();

        const table = new Table({
            head: [chalk.cyan("Metric"), chalk.cyan("Value")],
            colWidths: [22, 40]
        });

        table.push(
            ["Repository", chalk.yellow(data.full_name)],
            ["Description", data.description || "None"],
            ["Stars ⭐", data.stargazers_count],
            ["Forks 🍴", data.forks_count],
            ["Watchers 👀", data.watchers_count],
            ["Open Issues 🐞", data.open_issues_count],
            ["Language 💻", data.language],
            ["Repo Size 📦", data.size + " KB"],
            ["Contributors 👨‍💻", contributors],
            ["Releases 🚀", releases],
            ["Subscribers 👀", data.subscribers_count],
            ["Network 🌐", data.network_count],
            ["Created", new Date(data.created_at).toDateString()],
            ["Last Update", new Date(data.updated_at).toDateString()]
        );

        const title = gradient.pastel.multiline(`
      GitHub Repository Analyzer
        `);

        console.log(title);

        console.log(
            boxen(table.toString(), {
                padding: 1,
                margin: 1,
                borderStyle: "round",
                borderColor: "cyan"
            })
        );

        if (Object.keys(languages).length > 0) {

            const chart = renderLanguageChart(languages);

            console.log(
                boxen(chart, {
                    padding: 1,
                    borderStyle: "round",
                    borderColor: "green"
                })
            );
        }

        if (Array.isArray(commitActivity) && commitActivity.length) {

            const graph = renderCommitGraph(commitActivity);

            if (graph) {
                console.log(
                    boxen(graph, {
                        padding: 1,
                        borderStyle: "round",
                        borderColor: "yellow"
                    })
                );
            }
        }

    } catch (err) {

        spinner.stop();

        console.log(chalk.red("\nGitHub API Error\n"));

        if (err.response) {

            console.log(chalk.yellow("Status:"), err.response.status);

            if (err.response.data && err.response.data.message) {
                console.log(chalk.red("Message:"), err.response.data.message);
            }

            if (err.response.status === 403) {

                console.log(chalk.red("\nAPI rate limit exceeded."));
                console.log(chalk.gray("Limit: 60 requests/hour for public API"));
                console.log(chalk.gray("Use a GitHub token to increase limit."));
            }

            if (err.response.status === 404) {

                console.log(chalk.red("\nRepository not found."));
                console.log(chalk.gray("Check owner/repo format."));
            }

        } else {

            console.log(chalk.red("Network error:"), err.message);
        }
    }
}

const repo = process.argv[2];

if (!repo) {

    console.log(chalk.yellow("\nUsage:\n"));
    console.log("node analyze.js owner/repo\n");

    process.exit(0);
}

analyzeRepo(repo);