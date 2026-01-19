from playwright.sync_api import sync_playwright, expect
import re

def verify_storage_indicator(page):
    # Load the app
    page.goto("http://localhost:8080/")

    # Click "Continue as Guest"
    page.get_by_role("button", name="Continue as Guest").click()

    # Wait for the main app view to be visible
    expect(page.locator("#app-view")).to_be_visible()

    # Click the profile button to open the dropdown
    # The profile button has id "profile-btn" and title "Profile"
    page.locator("#profile-btn").click()

    # Wait for the dropdown to be visible
    dropdown = page.locator("#profile-dropdown")
    expect(dropdown).to_be_visible()

    # Wait a bit for animations if any
    page.wait_for_timeout(500)

    # Take a screenshot of the dropdown
    # We can screenshot the dropdown element itself or the whole page
    page.screenshot(path="verification/storage_indicator_full_no_text.png")
    dropdown.screenshot(path="verification/storage_indicator_dropdown_no_text.png")

    # Assertions
    # Check for "Storage" text
    expect(dropdown).to_contain_text("Storage")

    # Check that the helper text is NOT present
    # The text was "Safe limit (928KB) to prevent sync errors"
    expect(dropdown).not_to_contain_text("Safe limit (928KB) to prevent sync errors")

    # Check for usage text format "0.0 KB / 928 KB"
    expect(dropdown.locator("#storage-text")).to_contain_text("/ 928 KB")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_storage_indicator(page)
            print("Verification passed!")
        except Exception as e:
            print(f"Verification failed: {e}")
            page.screenshot(path="verification/failure.png")
            raise e
        finally:
            browser.close()
