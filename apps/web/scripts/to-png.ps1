# Converts any image Windows can decode (JPEG, etc.) into a 32-bit PNG, so the alpha-keying step
# in `key-alpha.mjs` has a PNG to work with. Windows-only, uses the built-in GDI+ codecs.
param(
  [Parameter(Mandatory = $true)][string]$In,
  [Parameter(Mandatory = $true)][string]$Out
)

Add-Type -AssemblyName System.Drawing

$source = [System.Drawing.Image]::FromFile((Resolve-Path $In))
$bitmap = New-Object System.Drawing.Bitmap($source.Width, $source.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.DrawImage($source, 0, 0, $source.Width, $source.Height)
$graphics.Dispose()
$bitmap.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)

Write-Output ("{0} -> {1} ({2}x{3})" -f $In, $Out, $bitmap.Width, $bitmap.Height)

$bitmap.Dispose()
$source.Dispose()
