// i18next initialization - must happen before DOM access
function initializeI18next() {
    return i18next.init({
        lng: navigator.language.startsWith('ja') ? 'ja' : 'en',
        fallbackLng: 'en',
        resources: {
            ja: {
                translation: {
                    pageTitle: 'Turf.js バッファ生成ツール',
                    title: 'バッファ生成ツール',
                    uploadBtn: '📤 CSVをアップロード (lat, lon)',
                    noFileSelected: 'ファイルが選択されていません',
                    loading: '読み込み中...',
                    emptyDataError: 'エラー: データが空です',
                    selectColumnsPrompt: '列を選択して「地図に描画」を押してください',
                    parseError: 'エラー: 解析に失敗しました',
                    latColLabel: '緯度 (Latitude) 列:',
                    lonColLabel: '経度 (Longitude) 列:',
                    applyMappingBtn: '地図に描画',
                    bufferRadiusLabel: 'バッファ半径 (メートル)',
                    generateBtn: 'バッファを生成',
                    downloadGeoJSON: 'GeoJSONをダウンロード',
                    downloadSVG: 'SVGをダウンロード',
                    invalidCoordinatesError: '有効な座標データを読み取れませんでした。列の選択を確認してください。',
                    pointsDrawn: '件のポイントを描画しました。',
                    uploadFirst: '先にCSVファイルをアップロードしてください。',
                    noValidPoints: '有効なポイントデータがありません。列の選択を確認してください。',
                    invalidRadius: '有効なバッファ半径を入力してください。',
                    generatingBuffer: 'バッファ生成中...',
                    bufferComplete: 'バッファ生成完了 (全 ',
                    bufferCompleteEnd: ' 件)',
                    bufferWarning: '警告: バッファが生成されませんでした (結果が空です)',
                    bufferError: 'エラー: バッファ生成に失敗しました (',
                    bufferException: 'バッファ生成中にエラーが発生しました。\n',
                    noVectorData: 'エクスポートするベクターデータがありません。'
                }
            },
            en: {
                translation: {
                    pageTitle: 'Turf.js Buffer Generation Tool',
                    title: 'Buffer Generation Tool',
                    uploadBtn: '📤 Upload CSV (lat, lon)',
                    noFileSelected: 'No file selected',
                    loading: 'Loading...',
                    emptyDataError: 'Error: Data is empty',
                    selectColumnsPrompt: 'Select columns and click "Apply to Map"',
                    parseError: 'Error: Failed to parse CSV',
                    latColLabel: 'Latitude Column:',
                    lonColLabel: 'Longitude Column:',
                    applyMappingBtn: 'Apply to Map',
                    bufferRadiusLabel: 'Buffer Radius (Meters)',
                    generateBtn: 'Generate Buffer',
                    downloadGeoJSON: 'Download GeoJSON',
                    downloadSVG: 'Download SVG',
                    invalidCoordinatesError: 'Could not read valid coordinate data. Please check column selection.',
                    pointsDrawn: ' points drawn.',
                    uploadFirst: 'Please upload a CSV file first.',
                    noValidPoints: 'No valid point data. Please check column selection.',
                    invalidRadius: 'Please enter a valid buffer radius.',
                    generatingBuffer: 'Generating buffer...',
                    bufferComplete: 'Buffer generation complete (Total: ',
                    bufferCompleteEnd: ' features)',
                    bufferWarning: 'Warning: No buffer was generated (empty result)',
                    bufferError: 'Error: Buffer generation failed (',
                    bufferException: 'An error occurred during buffer generation.\n',
                    noVectorData: 'No vector data to export.'
                }
            }
        }
    });
}

// Initialize i18next and update HTML lang attribute
function setupLanguage() {
    return initializeI18next().then(() => {
        document.documentElement.lang = i18next.language;
        initializeUI();
    });
}

// Initialize Map
const map = L.map('map').setView([35.6895, 139.6917], 10); // Default to Tokyo

// Add CartoDB Positron Tiles (Light Gray)
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 20
}).addTo(map);

// State
let rawCSVData = null;     // Raw parsed CSV data
let uploadedPoints = null; // GeoJSON FeatureCollection of Points
let pointsLayer = null;    // Leaflet GeoJSON layer for points
let bufferLayer = null;    // Leaflet GeoJSON layer for buffers
let generatedBufferGeoJSON = null; // GeoJSON FeatureCollection of Polygons

// DOM Elements
const uploadBtn = document.getElementById('uploadBtn');
const csvUpload = document.getElementById('csvUpload');
const fileNameDisplay = document.getElementById('fileName');
const statusMessage = document.getElementById('statusMessage');
const columnMappingDiv = document.getElementById('columnMapping');
const latColSelect = document.getElementById('latCol');
const lonColSelect = document.getElementById('lonCol');
const applyMappingBtn = document.getElementById('applyMappingBtn');
const bufferRadiusInput = document.getElementById('bufferRadius');
const generateBtn = document.getElementById('generateBtn');
const downloadGeoJSONBtn = document.getElementById('downloadGeoJSON');
const downloadSVGBtn = document.getElementById('downloadSVG');

// Event Listeners
uploadBtn.addEventListener('click', () => csvUpload.click());
csvUpload.addEventListener('change', handleFileUpload);
applyMappingBtn.addEventListener('click', processMappedData);
generateBtn.addEventListener('click', generateBuffer);
downloadGeoJSONBtn.addEventListener('click', downloadGeoJSON);
downloadSVGBtn.addEventListener('click', downloadSVG);

function initializeUI() {
    document.getElementById('pageTitle').textContent = i18next.t('pageTitle');
    document.getElementById('title').textContent = i18next.t('title');
    uploadBtn.textContent = i18next.t('uploadBtn');
    document.getElementById('fileName').textContent = i18next.t('noFileSelected');
    document.getElementById('latColLabel').textContent = i18next.t('latColLabel');
    document.getElementById('lonColLabel').textContent = i18next.t('lonColLabel');
    applyMappingBtn.textContent = i18next.t('applyMappingBtn');
    document.getElementById('bufferRadiusLabel').textContent = i18next.t('bufferRadiusLabel');
    generateBtn.textContent = i18next.t('generateBtn');
    downloadGeoJSONBtn.textContent = i18next.t('downloadGeoJSON');
    downloadSVGBtn.textContent = i18next.t('downloadSVG');
}

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    fileNameDisplay.textContent = file.name;
    statusMessage.textContent = i18next.t('loading');
    statusMessage.style.color = "#6b7280";
    columnMappingDiv.style.display = 'none';

    Papa.parse(file, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: function (results) {
            rawCSVData = results.data;

            if (rawCSVData.length === 0) {
                statusMessage.textContent = i18next.t('emptyDataError');
                statusMessage.style.color = "#ef4444";
                return;
            }

            // Populate selectors
            const keys = Object.keys(rawCSVData[0]);
            populateSelect(latColSelect, keys);
            populateSelect(lonColSelect, keys);

            // Auto-guess
            const latKey = keys.find(k => ['lat', 'latitude', '緯度', 'position', 'location', 'coordinates'].includes(k.toLowerCase()));
            const lonKey = keys.find(k => ['lon', 'lng', 'longitude', '経度', 'position', 'location', 'coordinates'].includes(k.toLowerCase()));

            if (latKey) latColSelect.value = latKey;
            if (lonKey) lonColSelect.value = lonKey;

            // Show mapping UI
            columnMappingDiv.style.display = 'block';

            // If we have a guess, try to process immediately
            if (latKey && lonKey) {
                processMappedData();
            } else {
                statusMessage.textContent = i18next.t('selectColumnsPrompt');
                statusMessage.style.color = "#0f6cbd";
            }
        },
        error: function (err) {
            console.error("CSV Parse Error:", err);
            statusMessage.textContent = i18next.t('parseError');
            statusMessage.style.color = "#ef4444";
        }
    });
}

function populateSelect(selectElement, options) {
    selectElement.innerHTML = '';
    options.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt;
        option.textContent = opt;
        selectElement.appendChild(option);
    });
}

function processMappedData() {
    if (!rawCSVData) return;

    const latCol = latColSelect.value;
    const lonCol = lonColSelect.value;

    const features = rawCSVData.map(row => {
        let lat, lon;

        if (latCol === lonCol) {
            // Single column mode (e.g. "35.6895, 139.6917")
            const val = String(row[latCol]);
            // Try splitting by comma, then space
            let parts = val.split(',');
            if (parts.length < 2) parts = val.split(/\s+/);

            if (parts.length >= 2) {
                lat = parseFloat(parts[0].trim());
                lon = parseFloat(parts[1].trim());
            }
        } else {
            // Standard mode
            lat = parseFloat(row[latCol]);
            lon = parseFloat(row[lonCol]);
        }

        if (!isNaN(lat) && !isNaN(lon)) {
            // Normalize row data with explicit lat/lon for Turf
            const properties = { ...row, lat: lat, lon: lon };
            return turf.point([lon, lat], properties);
        }
        return null;
    }).filter(f => f !== null);

    if (features.length === 0) {
        alert(i18next.t('invalidCoordinatesError'));
        return;
    }

    uploadedPoints = turf.featureCollection(features);

    // Clear existing points layer
    if (pointsLayer) {
        map.removeLayer(pointsLayer);
    }

    // Add points to map
    pointsLayer = L.geoJSON(uploadedPoints, {
        pointToLayer: function (feature, latlng) {
            return L.circleMarker(latlng, {
                radius: 2,
                fillColor: "#0000ff",
                color: "#0000ff",
                weight: 1,
                opacity: 1,
                fillOpacity: 0.8
            });
        }
    }).addTo(map);

    // Fit map to points
    const bbox = turf.bbox(uploadedPoints);
    map.fitBounds([[bbox[1], bbox[0]], [bbox[3], bbox[2]]]);

    statusMessage.textContent = `${features.length} ${i18next.t('pointsDrawn')}`;
    statusMessage.style.color = "#10b981";
}

function generateBuffer() {
    if (!uploadedPoints) {
        alert(i18next.t('uploadFirst'));
        return;
    }

    if (uploadedPoints.features.length === 0) {
        alert(i18next.t('noValidPoints'));
        return;
    }

    const radius = parseFloat(bufferRadiusInput.value);
    if (isNaN(radius) || radius <= 0) {
        alert(i18next.t('invalidRadius'));
        return;
    }

    // Generate Buffers
    try {
        statusMessage.textContent = i18next.t('generatingBuffer');
        statusMessage.style.color = "#6b7280";

        // turf.buffer takes (geojson, radius, {units: '...'})
        generatedBufferGeoJSON = turf.buffer(uploadedPoints, radius, { units: 'meters' });

        // Clear existing layer
        if (bufferLayer) {
            map.removeLayer(bufferLayer);
        }

        // Add to map
        bufferLayer = L.geoJSON(generatedBufferGeoJSON, {
            style: {
                color: '#3388ff',
                weight: 2,
                opacity: 0.8,
                fillColor: '#3388ff',
                fillOpacity: 0.2
            }
        }).addTo(map);

        // Fit map to buffer
        const bufferBbox = turf.bbox(generatedBufferGeoJSON);
        map.fitBounds([[bufferBbox[1], bufferBbox[0]], [bufferBbox[3], bufferBbox[2]]]);

        // Enable download buttons
        downloadGeoJSONBtn.disabled = false;
        downloadSVGBtn.disabled = false;

        if (!generatedBufferGeoJSON || generatedBufferGeoJSON.features.length === 0) {
            statusMessage.innerHTML = i18next.t('bufferWarning');
            statusMessage.style.color = "#ef4444";
        } else {
            statusMessage.textContent = i18next.t('bufferComplete') + generatedBufferGeoJSON.features.length + i18next.t('bufferCompleteEnd');
            statusMessage.style.color = "#10b981";
        }
    } catch (err) {
        console.error("Buffer Generation Error:", err);
        statusMessage.textContent = i18next.t('bufferError') + err.message + ")";
        statusMessage.style.color = "#ef4444";
        alert(i18next.t('bufferException') + err.message);
    }
}

function downloadGeoJSON() {
    if (!generatedBufferGeoJSON) return;

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(generatedBufferGeoJSON));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "buffer_output.geojson");
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}

function downloadSVG() {
    // This is a simple SVG export that grabs the SVG overlay from Leaflet.
    // Note: This only exports the visible part of the map's vector layers.
    // For a full export of all data regardless of zoom, we'd need a different approach (e.g. D3 standalone),
    // but usually "download what I see" is what's expected in this context.

    const svg = document.querySelector('.leaflet-overlay-pane svg');
    if (!svg) {
        alert(i18next.t('noVectorData'));
        return;
    }

    // Clone the SVG to not mess with the map
    const svgClone = svg.cloneNode(true);

    // We need to ensure the SVG has proper bounds/viewBox if we want it to be standalone,
    // but Leaflet SVGs are positioned absolutely.
    // A simple hack is to wrap it in a basic SVG structure or just save it as is.
    // Leaflet 1.0+ uses a big SVG for the overlay pane.

    // Let's serialize it.
    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(svgClone);

    // Add XML declaration
    if (!source.match(/^<xml/)) {
        source = '<?xml version="1.0" standalone="no"?>\r\n' + source;
    }

    const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(source);

    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", url);
    downloadAnchorNode.setAttribute("download", "buffer_map.svg");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}

// Initialize language and UI
setupLanguage();
