import time
from playwright.sync_api import sync_playwright

def test_shortcuts():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()
        
        # Navigate to the app
        print("Navigating to http://localhost:3002...")
        page.goto('http://localhost:3002')
        page.wait_for_load_state('networkidle')
        
        # 1. Test Double-Shift to start session
        print("Testing Double-Shift to start session...")
        page.keyboard.press('Shift')
        time.sleep(0.1)
        page.keyboard.press('Shift')
        
        # Wait for session to start - should see "End Session"
        # Note: it might prompt for screen share, which we can't easily handle in headless
        # but the UI state should change to "ACTIVE" or show "End Session"
        try:
            page.wait_for_selector('text=End Session', timeout=5000)
            print("✅ Session started successfully via Double-Shift")
        except Exception as e:
            print("❌ Failed to start session via Double-Shift or 'End Session' button not found")
            # Take a screenshot for debugging
            page.screenshot(path='tests/failure_session.png')
            # browser.close()
            # return

        # Mocking screen share state if needed? 
        # Actually, if toggleScreenShare is called, isScreenSharing becomes true
        # In headless, it might fail to get display media, but let's see.
        
        # 2. Test Space bar to activate screenshot tool
        # We need isScreenSharing to be true for Space to work.
        # Since headless might block screen share, let's check the console or force it if possible.
        # For this test, we'll assume the session started and we try to trigger screenshot.
        
        # Wait a bit for any transitions
        time.sleep(1)
        
        print("Testing Space bar for screenshot tool...")
        page.keyboard.press('Space')
        
        # Check for visual indicator (e.g. the overlay with "Press Space to Capture")
        try:
            # The overlay is in App.tsx:693
            page.wait_for_selector('text=Press Space to Capture', timeout=2000)
            print("✅ Screenshot tool activated via Space")
        except Exception:
            print("❌ Screenshot tool did not activate (is screen sharing active?)")
            page.screenshot(path='tests/failure_space.png')

        # 3. Test Space bar to capture
        print("Testing Space bar to capture...")
        page.keyboard.press('Space')
        time.sleep(0.5)
        
        # Check if overlay is gone
        if page.query_selector('text=Press Space to Capture') is None:
            print("✅ Screenshot captured and tool deactivated via Space")
        else:
            print("❌ Screenshot tool still active after second Space press")

        # 4. Test Escape to cancel
        print("Testing Escape to cancel...")
        page.keyboard.press('Space') # Reactivate
        time.sleep(0.5)
        page.keyboard.press('Escape')
        time.sleep(0.5)
        
        if page.query_selector('text=Press Space to Capture') is None:
            print("✅ Screenshot tool cancelled via Escape")
        else:
            print("❌ Screenshot tool still active after Escape")

        browser.close()

if __name__ == "__main__":
    test_shortcuts()
