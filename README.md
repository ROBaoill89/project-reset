# Project Reset

A private, offline dashboard for one person's life-management system.

- Plain HTML, CSS and JavaScript. No build step, no dependencies, no backend.
- All data lives in the browser's local storage on the device.
- Nothing is sent anywhere. No analytics. The only outside links are the ones to claude.ai that you tap yourself.

## Put it online (GitHub Pages, free)

1. Open the repository on github.com.
2. **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
4. Pick the branch that holds the app (e.g. `main`) and the folder **/ (root)**. Press **Save**.
5. Wait about a minute, then open `https://<your-username>.github.io/project-reset/`.

The code is public, but your data never is: it stays on your phone.

## Add to the iPhone Home Screen

1. Open the address above in **Safari**.
2. Tap **Share** → **Add to Home Screen**.
3. Leave **Open as Web App** switched on. Tap **Add**.
4. Always open it from the Home Screen icon from now on.

The Home Screen app and Safari keep **separate** data on iPhone. Use the Home Screen app as the real one.

## Backup

**More → Settings & backup → Export backup**. Import the same file to restore, or to move to another device.

## Deep links

Add these to the end of the app address:

| Link | Opens |
| --- | --- |
| `?go=today` | Today |
| `?go=capture` | Parking Lot, ready to type |
| `?go=capture&text=My%20idea` | Adds "My idea" to the Parking Lot |
| `?go=report` | Paste Report |
| `?go=review` | Weekly Review |
| `?go=status` | Copy Status |
| `?go=ask` | Today, with Ask Claude open |

## Updating

The app saves a copy of itself for offline use. After a new version is published, open the app twice to see it.
