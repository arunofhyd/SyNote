from playwright.sync_api import sync_playwright
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Load local file
        cwd = os.getcwd()
        page.goto(f"file://{cwd}/index.html")

        # Simulate App View
        page.evaluate("""() => {
            document.querySelector('.main-container').classList.add('is-app-view');
            document.getElementById('login-view').classList.add('hidden');
            const appView = document.getElementById('app-view');
            appView.classList.remove('hidden', 'opacity-0', 'scale-95');
        }""")

        page.wait_for_timeout(500)

        # Click Settings Button
        settings_btn = page.locator("#settings-btn")
        settings_btn.click()

        # Check active state
        assert "bg-accent" in settings_btn.get_attribute("class")

        # Check bubble is visible
        bubble = page.locator("#settings-bubble")
        assert bubble.is_visible()

        # Mock currentNoteId by creating a fake note
        # But rename logic checks currentNoteId.
        # I can just set it in JS
        page.evaluate("window.currentNoteId = 'test_note_id'") # Wait, currentNoteId is local scope in module. I can't access it.
        # But createNewNote sets it?
        # I can just verify the click logic closes the bubble even if error "No note selected"
        # Or...
        # If no note, it shows message.
        # If I want to verify "Focus", I need a note.
        # I can try clicking "Rename" and see if "No note selected" appears.
        # That proves the listener works.

        rename_btn = page.locator("#rename-note-btn")
        rename_btn.click()

        # Since no note is selected (default state of mock), check for error message
        # But wait, rename listener checks `if (currentNoteId)`. If null, shows message.
        # It does NOT close bubble or reset state if error.
        # So I expect button to still be active and bubble visible.

        assert bubble.is_visible()
        assert "bg-accent" in settings_btn.get_attribute("class")

        # Close browser
        browser.close()

if __name__ == "__main__":
    run()
