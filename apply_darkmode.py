import re

with open('index.html', 'r', encoding='utf-8') as f:
    text = f.read()

# Replace body styles
old_body = """body {
  font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Arial, sans-serif;
  background: #f8f8f8;
  color: #1a1a1a;
  line-height: 1.5;
  min-height: 100vh;
}"""

new_body = """body {
  font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Arial, sans-serif;
  background: var(--gray-50);
  color: var(--gray-800);
  line-height: 1.5;
  min-height: 100vh;
  transition: background 0.3s, color 0.3s;
}"""
text = text.replace(old_body, new_body)

# Add dark theme CSS
dark_theme = """
[data-theme="dark"] {
  --red: #e74c3c;
  --red-light: #ff7675;
  --red-bg: #3a1c1d;
  --red-border: #e74c3c;
  --white: #1e1e1e;
  --gray-50: #121212;
  --gray-100: #1a1a1a;
  --gray-200: #2c2c2c;
  --gray-300: #3f3f3f;
  --gray-400: #555555;
  --gray-500: #737373;
  --gray-600: #a0a0a0;
  --gray-700: #cccccc;
  --gray-800: #e0e0e0;
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.3);
  --shadow: 0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.24);
  --shadow-md: 0 4px 6px rgba(0,0,0,0.5), 0 2px 4px rgba(0,0,0,0.3);
  --shadow-lg: 0 10px 15px rgba(0,0,0,0.6), 0 4px 6px rgba(0,0,0,0.4);
}
"""
if '[data-theme="dark"]' not in text:
    text = text.replace("  --radius-lg: 12px;\n}", "  --radius-lg: 12px;\n}" + dark_theme)

# Replace header
old_header = """<header id="app-header" class="no-print">
  <div class="header-inner">
    <div class="app-logo" onclick="navigate('new')">Local<span>Invoice</span></div>
    <nav>
      <button id="nav-new" onclick="navigate('new')">➕ New Invoice</button>
      <button id="nav-history" onclick="navigate('history')">📋 History</button>
      <button id="nav-items" onclick="navigate('items')">📦 Items</button>
      <button id="nav-settings" onclick="navigate('settings')">⚙️ Settings</button>
    </nav>
  </div>
</header>"""

new_header = """<header id="app-header" class="no-print">
  <div class="header-inner">
    <div class="app-logo" onclick="navigate('new')" style="display:flex; align-items:center; gap:8px;">
      <img src="logo.png" alt="Logo" style="width:32px; height:32px; border-radius:6px; object-fit:cover;">
      <div>Local<span>Invoice</span></div>
    </div>
    <nav>
      <button id="nav-new" onclick="navigate('new')">➕ New Invoice</button>
      <button id="nav-history" onclick="navigate('history')">📋 History</button>
      <button id="nav-items" onclick="navigate('items')">📦 Items</button>
      <button id="nav-settings" onclick="navigate('settings')">⚙️ Settings</button>
      <button id="theme-toggle" onclick="toggleTheme()" style="padding:8px 12px;" title="Toggle Dark Mode">🌙</button>
    </nav>
  </div>
</header>"""
text = text.replace(old_header, new_header)

# Add JS logic
js_code = """/* ==========================================================
   LocalInvoice — Complete Vanilla JS Application
   ========================================================== */

// ===== THEME LOGIC =====
function toggleTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const newTheme = isDark ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('localinvoice_theme', newTheme);
  const toggle = document.getElementById('theme-toggle');
  if (toggle) toggle.textContent = newTheme === 'dark' ? '☀️' : '🌙';
}

function initTheme() {
  const savedTheme = localStorage.getItem('localinvoice_theme');
  if (savedTheme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
}
initTheme();
"""
text = text.replace("""/* ==========================================================
   LocalInvoice — Complete Vanilla JS Application
   ========================================================== */""", js_code)

# Make sure toggle button gets updated if initTheme runs before DOM loads
js_init_dom = """window.addEventListener('DOMContentLoaded', () => {
  initTheme();
  const savedTheme = localStorage.getItem('localinvoice_theme');
  const toggle = document.getElementById('theme-toggle');
  if (toggle) toggle.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
});"""
text = text.replace("initTheme();\n", "initTheme();\n" + js_init_dom + "\n")


with open('index.html', 'w', encoding='utf-8') as f:
    f.write(text)
print("Updated successfully")
