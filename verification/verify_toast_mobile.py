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

        # Simulate App View and show message
        page.evaluate("""() => {
            document.querySelector('.main-container').classList.add('is-app-view');
            document.getElementById('login-view').classList.add('hidden');
            const appView = document.getElementById('app-view');
            appView.classList.remove('hidden', 'opacity-0', 'scale-95');

            // Show settings bubble
            const bubble = document.getElementById('settings-bubble');
            bubble.classList.remove('hidden');

            // Trigger message
            // Need to call showMessage exposed globally or simulating event
            // Since main.js is module, function is not global.
            // But we can manually set class on message-display

            const msg = document.getElementById('message-display');
            const msgText = document.getElementById('message-text');
            msgText.textContent = "Test Confirmation Message";

            // Apply new classes manually to test layout?
            // No, verify the JS change works. But JS module exports not available.
            // Wait, we modified main.js file.
            // But we can't call showMessage from console if it's not on window.
            // However, we can simulate an action that calls it.
            // e.g. click copy button.

            // Wait, copy button is in the bubble.
            // Since bubble is shown, we can click it.
            // Copy requires clipboard permission/api which might be tricky in headless.
            // Maybe "Clear All"? It shows confirmation message "Click again to confirm."

        }""")

        # Click Clear All to trigger message
        # Button ID "clear-all-btn"
        # It is inside #settings-bubble
        page.locator("#clear-all-btn").click()

        page.wait_for_timeout(500)

        # Take screenshot
        page.screenshot(path="verification/mobile_toast.png")

        browser.close()

if __name__ == "__main__":
    run()
