# @sweety/client

The Sweety web client, built with React and Vite.

People can sign up, log in and log out, and the session is kept across reloads. The dashboard, readings and reports pages are only available when logged in: visiting them while logged out leads to the login page and back again afterwards, and logged-in users are sent from the login and signup pages to the dashboard. On the readings page (`/readings`) people pick a date, see that day's readings by time slot, and add, edit and delete readings. The reports page (`/reports`) shows the daily, month-to-date and previous-month summaries for a chosen date, with a month-to-date chart of the readings by time slot. See the root README for details. From the repository root, run `npm run dev:client`.
