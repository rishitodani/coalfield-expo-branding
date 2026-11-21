# Coalfield Trade Expo 2026 - branding registration: setup (about 15 minutes)

You need: the Google account contact@printking.in, and somewhere to host `index.html` (GitHub Pages works).

## 1. Create the backend (as contact@printking.in)
1. In Google Drive, create a new Google Sheet and name it "Branding registrations".
2. In the sheet, open Extensions > Apps Script.
3. Delete the default code and paste the whole of `Code.gs`.
4. Click the gear icon (Project Settings) and tick "Show appsscript.json manifest file in editor". Open `appsscript.json` and paste the supplied one.
5. Click Services (+), add "Drive API" (v3) if it is not already listed.
6. Select the function `doGet` in the toolbar and click Run. Approve the permissions (Drive, Sheets, send email, external requests). Google will warn the app is unverified: choose Advanced > Go to project.
7. Click Deploy > New deployment > type "Web app". Set "Execute as: Me" and "Who has access: Anyone". Deploy and copy the Web app URL.

## 2. Put the form online
1. Open `index.html` in a text editor. Find `BACKEND_URL: ''` near the top of the script and paste the Web app URL between the quotes.
2. Upload `index.html` to your hosting (for example GitHub Pages).

## 3. Test before sharing
1. Open the form, fill it with test data, use small files and a screenshot, and submit.
2. Check: a folder "BR-001 - <company>" appears in Drive under "Coalfield Trade Expo 2026 - Branding" with one subfolder per part and a "Payment" subfolder; the "Submissions" tab in the sheet has the row with status RECEIVED; both emails arrive.
3. Test one large file (50 MB or more) to be sure big uploads work.
4. Delete the test folder and the test row (so numbering restarts at BR-001).

## Settings to confirm
- GST rate: `GST_RATE: 18` in BOTH `Code.gs` and `index.html`. Change both if it is not 18.
- Prices: the `PRICES` block is in both files. Keep them identical.
- Deadline: `DEADLINE` in both files (30 November 2026, 11:59 pm IST). Set `CLOSE_AFTER_DEADLINE: false` in `Code.gs` to keep accepting after the deadline; the page itself also hides the form after the deadline.
- After any change to `Code.gs`: Deploy > Manage deployments > edit (pencil) > Version "New version" > Deploy. The URL stays the same.

## What you get
- Drive: `Coalfield Trade Expo 2026 - Branding / BR-001 - Company name / 01 Left wall, 02 Back wall, 03 Right wall, 04 Table vinyl, 05 Design brief, 06 Payment` plus a "Registration details.txt".
- Sheet: one row per registration with all choices, amounts, payment details and the folder link. The last two columns (Work status, Notes) are yours to fill.
- Rows with status INCOMPLETE are people who started but did not finish uploading.
