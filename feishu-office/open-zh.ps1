$url = "http://localhost:3012"

if (Get-Command msedge -ErrorAction SilentlyContinue) {
  Start-Process msedge "--lang=zh-CN $url"
  exit 0
}

if (Get-Command chrome -ErrorAction SilentlyContinue) {
  Start-Process chrome "--lang=zh-CN $url"
  exit 0
}

Start-Process $url
