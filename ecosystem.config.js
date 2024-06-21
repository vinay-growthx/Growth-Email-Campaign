module.exports = {
  apps: [
    {
      name: "app-blue",
      script: "app.js",
      watch: false,
      env: {
        PORT: 4000,
      },
      node_args: ["--max-old-space-size=4096"],
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },
    {
      name: "app-green",
      script: "app.js",
      watch: false,
      env: {
        PORT: 4001,
      },
      node_args: ["--max-old-space-size=4096"],
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },
  ],
};
