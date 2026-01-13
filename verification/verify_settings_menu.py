from playwright.sync_api import sync_playwright
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Load local file
        cwd = os.getcwd()
        page.goto(f"file://{cwd}/index.html")

        # Simulate App View and Toggle Bubble manually
        page.evaluate("""() => {
            document.querySelector('.main-container').classList.add('is-app-view');
            document.getElementById('login-view').classList.add('hidden');
            const appView = document.getElementById('app-view');
            appView.classList.remove('hidden', 'opacity-0', 'scale-95');

            // Toggle Bubble
            const bubble = document.getElementById('settings-bubble');
            bubble.classList.remove('hidden');
        }""")

        page.wait_for_timeout(500)

        # Verify bubble appears
        bubble = page.locator("#settings-bubble")
        assert bubble.is_visible()

        # Take screenshot
        page.screenshot(path="verification/settings_menu.png")

        browser.close()

if __name__ == "__main__":
    run()
