
# Task 1: Setup Electron Project

**Goal:** Initialize a new Node.js project and configure it with Electron and TypeScript.

### Steps:

1.  **Initialize Node.js Project:**
    *   Run `npm init -y` to create a `package.json` file.

2.  **Install Dependencies:**
    *   Install Electron, TypeScript, and the Electron TypeScript starter kit:
        ```bash
        npm install --save-dev electron @electron-forge/cli @electron-forge/maker-squirrel @electron-forge/maker-zip @electron-forge/plugin-webpack ts-node typescript
        ```

3.  **Initialize Electron Forge:**
    *   Run the following command to configure Electron Forge with the TypeScript + Webpack template:
        ```bash
        npx electron-forge import --template=webpack-typescript
        ```
    *   This will automatically create the necessary configuration files, including `webpack.config.js`, and a basic `src` directory with `main.ts` (main process) and `renderer.ts` (UI process).

4.  **Verify Setup:**
    *   Run `npm start` to launch the default Electron application window. Confirm that a "Hello World!" application appears.
