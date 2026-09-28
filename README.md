# 沙田區中學 · 資料與地圖

靜態網頁：列出沙田區中學公開資料、Leaflet / OpenStreetMap 地圖標記，以及點擊地圖量測直線距離（Haversine）。

## 本機預覽

無需建置、無需地圖 API 金鑰。任選一種靜態伺服器即可：

```bash
# Python
python3 -m http.server 8080

# 或 Node
npx --yes serve -l 8080
```

然後開啟 <http://localhost:8080>。

> 請勿直接用 `file://` 開啟：瀏覽器會阻擋對 `data/schools.json` 的 fetch。

## 功能

1. **學校資料**：45 所沙田區中學（教育局／中學概覽公開名單），含中文校名、類型、地址、電話、網址；並附民間參考組別（附免責聲明）。
2. **地圖**：Leaflet + OSM 圖磚標示各校位置與標籤。
3. **距離工具**：在地圖上點選一點，依直線距離由近至遠列出所有學校；選點以紅色圖釘標示。

## 資料與授權

- 學校聯絡／地址：教育局分區學校名單、中學學位分配辦法沙田區公開手冊等。
- 座標：OpenStreetMap / Photon（鄰里層級）；個別地址以公開校址微調。
- 地圖圖磚：© OpenStreetMap contributors。
- 「民間參考組別」非官方評級，僅供參考。

詳細說明見 Agent Store 文件（若由 Cloud Agent 產出）。
