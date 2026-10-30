# Portfolio

A minimal English portfolio with four project slots, published media, and optional Git repository and itch.io links. Visitors read the same published `projects.json` file. No build step or external backend is required.

## Publish with GitHub Pages

1. Put `index.html`, `style.css`, `app.js`, `publisher.js`, `projects.json`, `.nojekyll`, and this `README.md` at the repository root.
2. Push them to the `main` branch.
3. In the repository's **Settings → Pages**, select **Deploy from a branch**, then **main** and **/ (root)**.
4. Wait for deployment to finish and use the website URL shown by GitHub Pages. The repository URL displays source code; the Pages URL opens the portfolio.

All asset paths are relative, so the site can run under a repository subpath. Keep `.nojekyll` in the repository root.

## Visibility

Choose repository and website visibility deliberately. A public repository makes its source files visible to everyone. Website access and repository privacy are separate settings; check the Pages access configuration before treating the published site as private. Do not commit credentials or personal files that you do not want to publish.

## Editing projects

Open [the live portfolio](https://wangwu-1.github.io/portfolio/), select a project tab, and click **Manage work**. To authorize publishing, use a fine-grained GitHub personal access token belonging to `Wangwu-1` with access to **only `portfolio`** and **Contents: Read and write**. A creation link with those permission fields prefilled is provided in the page; explicitly select the `portfolio` repository in GitHub before generating the token.

The token is held only in this tab's memory and sent only to `https://api.github.com`. It is not written to browser storage, the source repository, project JSON, or URLs. Reloading, closing the tab, or signing out clears it. Do not paste credentials into the chat or commit them to the repository. Token creation is documented in [GitHub's guide](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens).

Add a name, optional category and description, a file, or Git / itch.io links. **Save & publish** commits the selected project and any new media to GitHub. Other slots are preserved. After GitHub Pages deploys the commit, everyone sees the same content. The page reports when a commit is saved and checks whether the public version has appeared; deployment is not instantaneous.

Supported files: JPG, PNG, WebP, GIF, PDF, MP4, and WebM, up to 100 MiB each. Uploaded files and all committed project details become public, including in Git history. Removing a project removes it from the current portfolio; old media and history are retained.

## Migrate earlier local previews

Older versions saved projects in IndexedDB under `liubai-portfolio-v1`, separately for every browser and origin. This version detects those local drafts and offers **Review saved drafts**. Authenticate as the owner, review each draft, and use **Save & publish**. A draft is removed from local storage only after its commit succeeds. Unpublished drafts never appear in the public portfolio.

If the drafts were saved in the original local HTML, refresh the updated copy of that same file in that same browser. Opening the GitHub address does not grant access to data saved under a local file URL. The local HTML also reads the public portfolio but can review its own old browser drafts.

## Local preview

Run `python -m http.server 4173` in this folder and open `http://localhost:4173`. Files can also be opened directly, but browser storage support for file URLs varies.
