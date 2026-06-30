# JCF Payroll

JCF Payroll is a mobile time-clock and payroll tracking app built with Expo, React Native, Firebase Authentication, and Firestore. The app allows employees to clock in and out from job sites, while admins can manage employees, approve accounts, manage job sites, edit time entries, and review payroll hours by period.

## Features

### Employee Features

- Email/password login and registration
- Account approval flow
- Pending approval screen for new users
- Clock in and clock out
- Job-site selection
- Location capture when clocking in/out
- Persistent active clock-in after closing/reopening the app
- Employee timesheet history
- Weekly hour summary

### Admin Features

- Admin-only bottom tab visibility
- Admin dashboard with internal menu sections
- Employee approval and management
- Activate/deactivate employees
- Add and delete job sites
- View time entries
- Close active shifts manually
- Edit time entries
- Audit logs saved to Firestore when time entries are edited
- Payroll period filtering:
  - This Week
  - Last Week
  - This Month
  - All Time
  - Custom Start/End Dates

## Tech Stack

- Expo
- React Native
- Expo Router
- TypeScript
- Firebase Authentication
- Firebase Firestore
- Expo Location
- EAS Update

## Project Structure

```text
jcf-payroll/
├── app/
│   ├── (tabs)/
│   │   ├── index.tsx        # Employee clock-in / clock-out screen
│   │   ├── explore.tsx      # Employee timesheets screen
│   │   ├── admin.tsx        # Admin dashboard and management tools
│   │   └── _layout.tsx      # Tab navigation and admin tab visibility
│   └── _layout.tsx
├── assets/
│   └── images/
│       └── jcf-logo.png
├── src/
│   └── firebase.ts          # Firebase config and exports
├── app.json
├── package.json
├── tsconfig.json
└── README.md