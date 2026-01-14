# SyNote

<p align="center">
  <img src="./assets/logo.png" alt="SyNote Logo" width="120" height="120" />
</p>

<h3 align="center">Simple. Elegant. Real-time.</h3>

<p align="center">
  SyNote is a minimalist, progressive web application (PWA) designed for seamless note-taking. <br>
  Whether you're online or offline, your notes are always with you.
</p>

---

## ✨ Key Features

*   **🔄 Real-time Synchronization**
    *   Powered by **Firebase Firestore**, your notes sync instantly across all your devices.
    *   Collaborate effortlessly—changes appear as they happen.

*   **🕵️ Guest Mode & Privacy**
    *   Try it out without signing in! Guest notes are stored locally in your browser's `localStorage`.
    *   **Data Compression:** We use **LZ-String** compression to maximize storage space and keep your data efficient.

*   **🧮 Smart Math Integration**
    *   Perform quick calculations right inside your notes.
    *   Just type an expression ending with `=` (e.g., `25 * 4 =`) and SyNote automatically appends the result (`100`).

*   **📱 Progressive Web App (PWA)**
    *   Install SyNote on your desktop or mobile device for a native app experience.
    *   Works offline! (Cache-first strategy with Service Workers).

*   **🎨 Beautiful UI/UX**
    *   **Dark Mode**: Fully supported with a smooth toggle switch.
    *   **Responsive Design**: A collapsible sidebar and mobile-optimized layout ensure a great experience on any screen size.
    *   **Search**: Instant client-side search filters through your notes (even the compressed ones!) as you type.

*   **🔒 Secure**
    *   Authentication via **Google** or **Email/Password**.
    *   Secure data access rules ensure only you can see your notes.

## 🛠️ Tech Stack

*   **Frontend:** HTML5, Vanilla JavaScript (ES6 Modules)
*   **Styling:** [Tailwind CSS](https://tailwindcss.com/) (via CDN with custom configuration)
*   **Backend / Database:** [Firebase](https://firebase.google.com/) (Authentication, Firestore)
*   **Libraries:**
    *   `lz-string` for client-side compression.
    *   `expr-eval` for safe mathematical expression evaluation.
    *   FontAwesome for icons.

## 🚀 Getting Started

Since SyNote is a static web application, getting it running locally is super simple.

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/synote.git
    cd synote
    ```

2.  **Serve the files:**
    You can use any static file server. For example, with Python:
    ```bash
    # Python 3
    python -m http.server 8000
    ```
    Or with Node.js `http-server`:
    ```bash
    npx http-server .
    ```

3.  **Open in Browser:**
    Navigate to `http://localhost:8000` to start taking notes!

## 🌐 Deployment

SyNote is optimized for static hosting platforms like **Netlify**, **Vercel**, or **GitHub Pages**.

The live version is hosted at: **[https://synote.netlify.app/](https://synote.netlify.app/)**

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

---

<p align="center">
  Made with ❤️ by <a href="mailto:arunthomas04042001@gmail.com">Arun Thomas</a>
</p>
