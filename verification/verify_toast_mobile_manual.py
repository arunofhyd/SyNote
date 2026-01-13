from playwright.sync_api import sync_playwright
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Mobile viewport
        context = browser.new_context(viewport={"width": 375, "height": 667})
        page = context.new_page()

        cwd = os.getcwd()
        page.goto(f"file://{cwd}/index.html")

        # Simulate App View and show message manually
        page.evaluate("""() => {
            document.querySelector('.main-container').classList.add('is-app-view');
            document.getElementById('login-view').classList.add('hidden');
            const appView = document.getElementById('app-view');
            appView.classList.remove('hidden', 'opacity-0', 'scale-95');

            // Show settings bubble
            const bubble = document.getElementById('settings-bubble');
            bubble.classList.remove('hidden');

            // Show message manually with new classes
            const msg = document.getElementById('message-display');
            const msgText = document.getElementById('message-text');
            msgText.textContent = "Click again to confirm.";

            // Exact classes from main.js update + visual styles
            msg.className = 'fixed bottom-24 left-1/2 -translate-x-1/2 md:translate-x-0 md:left-auto md:bottom-5 md:right-5 z-50 px-4 py-3 rounded-md shadow-lg border transition-all duration-300 transform translate-y-0 opacity-100 flex items-center gap-2 text-sm w-[90%] md:w-auto justify-center md:justify-start bg-background text-foreground border-border';
        }""")

        page.wait_for_timeout(500)

        # Take screenshot
        page.screenshot(path="verification/mobile_toast_manual.png")

        browser.close()

if __name__ == "__main__":
    run()
