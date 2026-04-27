# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Lokale ontwikkeling

Project draaien op eigen machine:
1. `npm install` - installeert de dependencies
2. `npm run dev` - start de Vite dev-server op http://localhost:5173

## Leerlog

### Les 1 - Toolset installeren en eerste clone
- Node.js, Git, VS Code en Claude Code geïnstalleerd op iMac
- SSH-koppeling gemaakt met GitHub
- CausalNet gecloned vanuit GitHub naar lokale machine
- Eerste keer Vite dev-server lokaal gedraaid op localhost:5173
- Kennisgemaakt met git status, git diff en branches

### Les 2 - De volledige git-workflow
- Branch aanmaken met git checkout -b
- Bestand aanpassen en opslaan in VS Code (Cmd+S)
- Staging area begrijpen: git add
- Committen met een beschrijvende message
- Pushen naar GitHub met git push -u origin
- Pull Request maken en mergen op GitHub
- Lokaal opruimen: git checkout main, git pull, git branch -d