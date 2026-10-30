# ============================================================================
# SISTEM REPORT PEKERJAAN AUTO ELECTRICIAN - PT. SAMUDERA MULIA ABADI (KONAWE)
# File: build_standalone.ps1
# Fungsi: Compiler Standalone PWA Web App untuk Vercel / Cloudflare Pages / Netlify
# Penanggung Jawab: ZettBOT by Zettbos (System Architect & Lead Engineering Mentor)
# ============================================================================

$root = $PSScriptRoot
if (-not $root) { $root = Get-Location }

$distDir = Join-Path $root "dist"
if (-not (Test-Path $distDir)) {
    New-Item -ItemType Directory -Path $distDir | Out-Null
}

Write-Output "==> Memulai Kompilasi Standalone PWA Web App..."

$indexContent = Get-Content (Join-Path $root "index.html") -Raw -Encoding UTF8

# Regex untuk mencocokkan <?!= include('filename'); ?>
$includePattern = '<\?!\s*=\s*include\([`''"]([^`''"]+)[`''"]\);\s*\?>'

$compiledContent = [System.Text.RegularExpressions.Regex]::Replace($indexContent, $includePattern, {
    param($match)
    $filename = $match.Groups[1].Value
    $subPath = Join-Path $root "$filename.html"
    if (Test-Path $subPath) {
        [Console]::WriteLine("    -> Menyertakan modul: $filename.html")
        return [System.IO.File]::ReadAllText($subPath, [System.Text.Encoding]::UTF8)
    } else {
        [Console]::WriteLine("    [WARNING] Modul tidak ditemukan: $subPath")
        return ""
    }
})

# Tambahkan PWA Meta Tags di dalam <head>
$pwaTags = @"
    <!-- PWA Manifest & Standalone App Capabilities -->
    <link rel="manifest" href="manifest.json">
    <meta name="theme-color" content="#0d1829">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="apple-mobile-web-app-title" content="AE-Report SMA">
"@

$compiledContent = $compiledContent.Replace("</head>", "$pwaTags`n</head>")

# Tambahkan Service Worker Registration sebelum </body>
$swScript = @"
    <script>
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', function() {
          navigator.serviceWorker.register('./sw.js').then(function(reg) {
            console.log('⚡ PWA Service Worker Registered:', reg.scope);
          }).catch(function(err) {
            console.warn('SW registration skipped:', err);
          });
        });
      }
    </script>
"@

$compiledContent = $compiledContent.Replace("</body>", "$swScript`n</body>")

$distIndex = Join-Path $distDir "index.html"
[System.IO.File]::WriteAllText($distIndex, $compiledContent, [System.Text.Encoding]::UTF8)

Write-Output "==> Kompilasi Berhasil! Berkas tersimpan di: $distIndex"
Write-Output "    Ukuran Berkas: $([Math]::Round((Get-Item $distIndex).Length / 1KB, 2)) KB"
