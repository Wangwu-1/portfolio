# Portfolio

A minimal English portfolio with four project slots, file previews, and optional Git repository and itch.io links. No build step or dependencies are required.

## Publish with GitHub Pages

1. Put all five files from this folder at the repository root: `index.html`, `style.css`, `app.js`, `.nojekyll`, and this `README.md`.
2. Push them to the `main` branch.
3. In the repository's **Settings → Pages**, select **Deploy from a branch**, then **main** and **/ (root)**.
4. Wait for deployment to finish and use the website URL shown by GitHub Pages. The repository URL displays source code; the Pages URL opens the portfolio.

All asset paths are relative, so the site can run under a repository subpath. Keep `.nojekyll` in the repository root.

## Visibility

Choose repository and website visibility deliberately. A public repository makes its source files visible to everyone. Website access and repository privacy are separate settings; check the Pages access configuration before treating the published site as private. Do not commit credentials or personal files that you do not want to publish.

## Editing projects

Select one of the four project tabs, then click **Manage work**. You can add a name, category, short description, a file, a Git repository URL, and an itch.io URL. A project can contain links without a file.

**Save preview** stores edits only in the current browser using IndexedDB. These edits are not committed to GitHub, uploaded to a server, or synced across devices. Moving from a local file or another website to the Pages URL starts a separate browser storage area. Keep your original files.

To show the same finished work to all visitors, include its assets and project data in the site source and publish an updated commit. This package does not include a cloud upload backend.

## Local preview

Run `python -m http.server 4173` in this folder and open `http://localhost:4173`. Files can also be opened directly, but browser storage support for file URLs varies.
