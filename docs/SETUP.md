# Setup Guide — Adil Business Solutions (Phase 0)

Follow these once. ~15 minutes. Two halves: **backend** (Google) then **front-end** (GitHub).

---

## Part A — Backend (Google Sheet + Apps Script)

1. Go to <https://sheets.google.com> and create a **blank spreadsheet**. Name it e.g. *Adil Business Solutions DB*.

2. In the menu: **Extensions → Apps Script**. A code editor opens in a new tab.

3. Delete the sample `function myFunction(){}` code. Open `backend/Code.gs` from this project, copy **everything**, and paste it in. Click the **save** icon.

4. At the top of the editor, in the function dropdown choose **`setup`**, then click **Run**.
   - Google will ask for authorisation the first time → **Review permissions** → pick your Google account → **Advanced → Go to (project) → Allow**.
   - When it finishes you'll see a popup: *Setup complete. Default login: admin / admin123*.
   - Back in the Sheet, you'll now see all the tabs (Items, Customers, Invoices, Users, …).

5. Deploy it as a web app: **Deploy → New deployment**.
   - Click the gear ⚙ next to "Select type" → **Web app**.
   - **Description:** ABS API
   - **Execute as:** Me
   - **Who has access:** Anyone
   - Click **Deploy** → authorise if asked → **copy the Web app URL** (it ends with `/exec`).

> Keep that URL. That's your backend address.

---

## Part B — Front-end (config + GitHub Pages)

6. Open `assets/js/config.js`. Replace the placeholder:
   ```js
   API_URL: "PASTE_YOUR_WEB_APP_URL_HERE",
   ```
   with your copied URL:
   ```js
   API_URL: "https://script.google.com/macros/s/AKfyc.../exec",
   ```
   While you're there, edit the `COMPANY` block (name, address, phone, currency, etc.).

7. Create a **new GitHub repository** (e.g. `adil-business-solutions`). Upload all the files from this project, keeping the folder structure intact.

8. In the repo: **Settings → Pages**. Under "Build and deployment", set **Source: Deploy from a branch**, **Branch: `main` / `(root)`**, **Save**.
   - After a minute GitHub gives you a live URL like `https://yourname.github.io/adil-business-solutions/`.

9. Open that URL. You'll see the **login screen**. Sign in with:
   - **Username:** `admin`
   - **Password:** `admin123`

10. On the Dashboard, the **System status** card should turn **green — "Connected"**. That confirms the front-end is talking to your Google Sheet backend. 🎉

---

## Important first-day tasks

- **Change the admin password.** For now, open the **Users** tab in the Sheet. We'll add a proper "change password" screen, but until then tell me a new password and I'll give you the exact hashed value to paste into `password_hash`. (Never store the plain password.)
- **Lock down sheet sharing.** Keep the Sheet private to you. Users never open it directly — they only use the app.
- **Re-deploying after backend changes:** when I send you updated `Code.gs`, paste it in, then **Deploy → Manage deployments → edit (pencil) → Version: New version → Deploy.** The URL stays the same.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Status card shows "Backend not configured" | `API_URL` in `config.js` is still the placeholder. |
| "Could not reach the backend" | Web app not deployed for **Anyone**, or wrong URL. Re-check Part A step 5. |
| "Unexpected response (not JSON)" | You copied the wrong URL (use the one ending `/exec`), or the deployment failed. |
| Login fails | Run `setup()` again; confirm the **Users** tab has the `admin` row. |
| Tabs missing in the Sheet | You didn't run `setup()` — go back to Part A step 4. |

When the dashboard is green, tell me and we start **Phase 1 (Items, Customers, Suppliers)**.
