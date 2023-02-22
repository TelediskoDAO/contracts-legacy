module.exports = {
  overrides: [
    {
      files: ["*.ts", "*.js"],
      options: {
        printWidth: 80,
        tabWidth: 2,
        useTabs: false,
        singleQuote: false,
        bracketSpacing: true,
      },
    },
    {
      files: "*.sol",
      options: {
        printWidth: 80,
        tabWidth: 2,
        useTabs: false,
        singleQuote: false,
        bracketSpacing: true,
      },
    },
    {
      files: "*.json",
      options: {
        printWidth: 0, // trick to have one item per line
      },
    },
  ],
};
