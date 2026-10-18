# 1. Set up your computer

You will install three free tools, download this project, and run its
automated checks. The checks are a few hundred small programs that test the
project. When they all pass, your setup works.

## What you are installing, and why

| Tool           | What it is                                                            | Why this project needs it                                                 |
| -------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| **A terminal** | A window where you type commands instead of clicking                  | Developer tools are run by typing commands. Your computer already has one |
| **Git**        | Keeps a project's history, and downloads projects                     | You will use it to download ("clone") this project                        |
| **Node.js**    | Runs programs written in JavaScript and TypeScript, outside a browser | The validator is written in TypeScript                                    |
| **pnpm**       | Downloads the libraries a project uses ("dependencies")               | This project's libraries are listed in `package.json`; pnpm fetches them  |

## Step 1: open a terminal

- **Windows:** press the Windows key, type **Terminal**, and press Enter. That
  opens Windows Terminal with PowerShell.
- **macOS:** press Command + Space, type **Terminal**, and press Enter.
- **Linux:** press Ctrl + Alt + T, or find **Terminal** in your applications.

You will see a **prompt**, such as `PS C:\Users\you>` or `you@computer ~ %`.
In these tutorials, a line you type is shown without the prompt. Type it, then
press Enter.

## Step 2: install Git

- **Windows:** download the installer from <https://git-scm.com/download/win>
  and accept the defaults.
- **macOS:** run `xcode-select --install`, which installs Apple's developer
  tools, Git included.
- **Linux (Debian or Ubuntu):** run `sudo apt install git`.

Check that it worked:

```bash
git --version
```

You should see something like `git version 2.47.1`. Any recent version is
fine.

## Step 3: install Node.js 24

Download the **LTS** installer for version 24 from <https://nodejs.org/> and
run it. LTS means "long-term support": the version that gets fixes for the
longest. On Linux, the same page explains how to use your package manager or
a version manager.

Then close the terminal, open a new one (so it sees the new program), and
check:

```bash
node --version
```

You should see `v24` followed by more numbers.

## Step 4: turn on pnpm

Node.js includes a helper called **Corepack**, which installs the exact pnpm
version a project asks for:

```bash
corepack enable pnpm
```

- **Windows:** if you see a permissions error, close the terminal, open it
  again with **Run as administrator**, and repeat the command.
- **macOS or Linux:** if you see a permissions error, run
  `sudo corepack enable pnpm`.

Check:

```bash
pnpm --version
```

## Step 5: download this project

Pick a folder for your projects. In your home folder is fine. Then:

```bash
git clone https://github.com/AutomateTheCloud/openwaymark.git
cd openwaymark
```

`git clone` copies the whole project, including its history, into a new
`openwaymark` folder. `cd` ("change directory") moves your terminal into it.

## Step 6: install the dependencies

```bash
pnpm install
```

pnpm reads `package.json`, downloads the libraries listed there, and saves them
in a `node_modules` folder. It also reads `pnpm-lock.yaml`, the **lockfile**,
which records the exact version of every library. Everyone who installs gets
precisely the same code.

> **A security habit worth knowing.** This project tells pnpm to install only
> library versions that have been public for at least 7 days
> (`minimumReleaseAge` in `pnpm-workspace.yaml`), and never to run install
> scripts from libraries. When attackers take over a library, they usually
> publish a bad version, and it is usually caught within days. Waiting avoids
> most of those attacks.

## Step 7: run the checks

```bash
pnpm check
```

This runs, in order:

1. **typecheck:** TypeScript checks that every value is used the way its type
   allows;
2. **lint:** ESLint looks for code patterns that are likely to be bugs;
3. **format check:** Prettier checks the layout of the code;
4. **tests:** Vitest runs a few hundred automated tests;
5. **spelling:** a small tool checks for British spellings, because the
   project uses American English;
6. **license headers:** every source file must carry its copyright line;
7. **spec rules:** every requirement in the specification must have a rule
   number.

If it ends without the word `ERR` or `failed`, your setup works. The test step
prints a line like:

```text
      Tests  273 passed (273)
```

## If something goes wrong

| You see                                             | Try                                                                                                     |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `command not found` or `is not recognized`          | Close and reopen the terminal. If it still happens, the install did not finish; run the installer again |
| `Unsupported engine` or a Node version error        | Install Node.js 24, not an older or newer major version                                                 |
| `ENOTFOUND` or network errors during `pnpm install` | Check your internet connection, then run it again                                                       |
| A test fails                                        | Run `pnpm test` to see the details. If you have changed nothing, please report it                       |

**Next:** [Make your first bundle](02-your-first-bundle.md).
