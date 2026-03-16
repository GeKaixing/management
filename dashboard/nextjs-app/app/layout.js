import "../styles/globals.css";

export const metadata = {
  title: "Remote Camera Dashboard",
  description: "Remote monitoring dashboard"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}