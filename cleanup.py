import re

with open('index.html', 'r', encoding='utf-8') as f:
    text = f.read()

# Fix duplicates
while 'async async ' in text:
    text = text.replace('async async ', 'async ')
while 'await await ' in text:
    text = text.replace('await await ', 'await ')

# Fix cancelInvoiceAction duplication
dup_cancel = """showConfirm('Cancel Invoice', `Mark invoice ${id} as Cancelled? This cannot be undone.`, async () => {
'Cancel Invoice', `Mark invoice ${id} as Cancelled? This cannot be undone.`, async () => {"""
text = text.replace(dup_cancel, """showConfirm('Cancel Invoice', `Mark invoice ${id} as Cancelled? This cannot be undone.`, async () => {""")

# Fix deleteItem duplication
dup_delete = """showConfirm('Delete Item', `Are you sure you want to delete "${name}"?`, async () => {'Delete Item', `Are you sure you want to delete "${name}"?`, async () => {"""
text = text.replace(dup_delete, """showConfirm('Delete Item', `Are you sure you want to delete "${name}"?`, async () => {""")

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(text)

print("Cleanup complete.")
