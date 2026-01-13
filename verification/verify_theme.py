from playwright.sync_api import sync_playwright
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Load local file
        cwd = os.getcwd()
        page.goto(f"file://{cwd}/index.html")

        # Simulate Dark Mode and App View state
        page.evaluate("""() => {
            // Force Dark Mode
            document.documentElement.classList.add('dark');

            // Show App View
            const appView = document.getElementById('app-view');
            appView.classList.remove('hidden', 'opacity-0', 'scale-95');
            document.querySelector('.main-container').classList.add('is-app-view');
            document.getElementById('login-view').classList.add('hidden');

            // Ensure Sidebar is visible (simulate desktop or open state)
            const sidebar = document.getElementById('sidebar');
            sidebar.classList.remove('-translate-x-full');
            // sidebar.style.transform = 'none'; // Force it if needed
        }""")

        # Wait for any transitions
        page.wait_for_timeout(500)

        # Take screenshot of the page, clipping to sidebar region
        page.screenshot(path="verification/sidebar_dark_mode.png", clip={"x": 0, "y": 0, "width": 300, "height": 100})

        browser.close()

if __name__ == "__main__":
    run()
