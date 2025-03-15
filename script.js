const getLocalizedNames = async () => {
    const response = await fetch('data/country.json')
    return response.json();
}
const localizeTiles = async () => {
    let geojson;
    try {
        geojson = await fetch('data/localized.geojson').then(response => response.json());
    }
    catch {
        const localizedNames = await getLocalizedNames();
        geojson = await getGeoJson();
        geojson.features.forEach(feature => {
            feature.properties.ADMIN = localizedNames[feature.properties.ISO_A2];
        });
    }
    return await geojson
}
const getGeoJson = async () => {
    const response = await fetch('data/countries.geojson');
    return await response.json();
}
const geojson = localizeTiles();
function createSpinner(container) {
    const spinner_container = document.createElement("div");
    spinner_container.id = 'loading-spinner';
    const spinner = document.createElement("div");
    spinner.classList.add('spinner');
    spinner_container.appendChild(spinner);
    container.prepend(spinner_container);
    spinner_container.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
}
function removeSpinner() {
    if (document.getElementById('loading-spinner')) document.getElementById('loading-spinner').remove();
}

const lowerOrRiseMap = (mapZIndex) => {
    const map = document.getElementById('map');
    mapZIndex ? map.style.zIndex = mapZIndex : map.style.zIndex = -1;
}
const temperaureData = {};
const getCsv = async () => {
    const response = await fetch('data/data.csv');
    return await response.text();
}
const csv = getCsv().then(resp => {
    const data = $.csv.toObjects(resp);

    data.forEach(element => {
        const temps = {};
        const region = element.Region;
        if (region === 'Total') {
            for (const year in element) {
                if (Number(year) && Number(element[year]))
                    temps[year] = element[year];
            }
            const country = element.ISO_Code;
            temperaureData[country] = temps;
        }

    });
}

);

function getTemperatureColor(temp) {
    const tempColors = [
        { temp: -20, color: "#264CFF" },
        { temp: -15, color: "#3FA0FF" },
        { temp: -10, color: "#72D8FF" },
        { temp: -5, color: "#AAF7FF" },
        { temp: 0, color: "#E0FFFF" },
        { temp: 5, color: "#98e608" },
        { temp: 10, color: "#FFE099" },
        { temp: 15, color: "#FFAD72" },
        { temp: 20, color: "#F76D5E" },
        { temp: 25, color: "#D82632" },
        { temp: 30, color: "#A50021" }
    ];
    if (!isNaN(Number(temp))) {
        for (let i = 0; i < tempColors.length - 1; i++) {
            if (temp <= tempColors[i].temp) return tempColors[i].color;
            if (temp < tempColors[i + 1].temp) {
                let ratio = (temp - tempColors[i].temp) / (tempColors[i + 1].temp - tempColors[i].temp);
                return interpolateColor(tempColors[i].color, tempColors[i + 1].color, ratio);
            }
        }
        return tempColors[tempColors.length - 1].color;
    }
    else return 'white';
}

function interpolateColor(color1, color2, ratio) {
    const hexToRgb = (hex) => {
        return [parseInt(hex.substring(1, 3), 16), parseInt(hex.substring(3, 5), 16), parseInt(hex.substring(5, 7), 16)];
    };
    const rgbToHex = (r, g, b) => {
        return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1).toUpperCase()}`;
    };

    let [r1, g1, b1] = hexToRgb(color1);
    let [r2, g2, b2] = hexToRgb(color2);

    let r = Math.round(r1 + (r2 - r1) * ratio);
    let g = Math.round(g1 + (g2 - g1) * ratio);
    let b = Math.round(b1 + (b2 - b1) * ratio);

    return rgbToHex(r, g, b);
}

const showCurrentLocationMarker = async (map) => {
    if (navigator.geolocation) {
        await navigator.geolocation.getCurrentPosition(success)
    }

    function success(position) {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        const marker = L.marker([lat, lon]).addTo(map);
        marker.bindPopup('Вы находитесь где-то здесь');
    }
}
function downloadFile(data, fileName) {
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName}.geojson`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
document.addEventListener('DOMContentLoaded', async () => {
    createSpinner(document.getElementById('map-container'));
    const mapZIndex = document.getElementById('map').style.zIndex || 2;
    lowerOrRiseMap();
    const map = L.map('map', {
        worldCopyJump: false,
        maxBounds: [
            [-90, -180],
            [90, 180]
        ],
        minZoom: 3,
        maxBoundsViscosity: 1.0
    }).setView([20, 0], 2);
    // L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
    //     attribution: '&copy; <a href="https://www.arcgis.com/">Esri</a>',
    //     maxZoom: 16
    // }).addTo(map);
    const getMeanTemp = (temps) => {
        return (Object.values(temps).reduce((accum, current) => accum + parseFloat(current), 0) / Object.values(temps).length).toFixed(2);
    }
    const onEachFeature = (feature, layer) => {
        if (temperaureData[feature.properties.ISO_A3]) {
            feature.properties.temp = getMeanTemp(temperaureData[feature.properties.ISO_A3]);
            layer.bindPopup(`${feature.properties.ADMIN}: ${feature.properties.temp}°C`);
        }
        else layer.bindPopup(feature.properties.ADMIN);
        layer.setStyle({
            fillColor: getTemperatureColor(feature.properties.temp),
            weight: 1,
            opacity: 1,
            color: 'white',
            fillOpacity: 0.7
        });

    }
    await geojson
        .then((geojson) => {
            L.geoJson(geojson, {
                onEachFeature: onEachFeature
            }).addTo(map);
            showCurrentLocationMarker(map);
            removeSpinner();
            lowerOrRiseMap(mapZIndex);
        }
        );

})