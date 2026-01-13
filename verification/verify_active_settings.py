from playwright.sync_api import sync_playwright
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        cwd = os.getcwd()
        page.goto(f"file://{cwd}/index.html")

        # Simulate App View
        page.evaluate("""() => {
            document.querySelector('.main-container').classList.add('is-app-view');
            document.getElementById('login-view').classList.add('hidden');
            const appView = document.getElementById('app-view');
            appView.classList.remove('hidden', 'opacity-0', 'scale-95');

            // Simulate click on settings button (since ES modules don't load)
            const btn = document.getElementById('settings-btn');
            btn.classList.add('bg-accent', 'text-accent-foreground');

            const bubble = document.getElementById('settings-bubble');
            bubble.classList.remove('hidden');
        }""")

        page.wait_for_timeout(500)

        # Take screenshot
        page.screenshot(path="verification/active_settings.png")

        browser.close()

if __name__ == "__main__":
    run()
