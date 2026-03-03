// 1. Inisialisasi Peta
var defaultCenter = [-2.5, 118.0];
var defaultZoom = 6;
var map = L.map('map', { zoomControl: false }).setView(defaultCenter, defaultZoom);

// 2. Basemaps
var satellite = L.tileLayer('https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
    maxZoom: 20, subdomains:['mt0','mt1','mt2','mt3']
}).addTo(map);

var osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png');

// 3. Kontrol Posisi
L.control.zoom({ position: 'topleft' }).addTo(map);
L.control.layers({"Satelit": satellite, "Street Map": osm}, null, { position: 'bottomleft' }).addTo(map);

// 4. Tombol Home (Pojok Kiri Atas)
var homeControl = L.Control.extend({
    options: { position: 'topleft' },
    onAdd: function (map) {
        var container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
        var button = L.DomUtil.create('a', '', container);
        button.innerHTML = '🏠';
        button.style.cursor = 'pointer';
        button.title = 'Kembali ke Indonesia';
        
        button.onclick = function() {
            map.setView(defaultCenter, defaultZoom);
        };
        return container;
    }
});
map.addControl(new homeControl());

// 4. Manajemen Layer (Global untuk Filter)
var layers = {
    site: L.layerGroup().addTo(map),
    bm: L.layerGroup().addTo(map),
    sta: L.layerGroup().addTo(map),
    alinyemen: L.layerGroup().addTo(map),
    row: L.layerGroup().addTo(map)
};

// 5. Fungsi Interaksi & Highlight
var lastClickedLayer = null;

function onEachFeature(feature, layer) {
    layer.on('click', function (e) {
        // Reset warna layer sebelumnya jika ada
        if (lastClickedLayer && lastClickedLayer.setStyle) {
            lastClickedLayer.setStyle({ color: lastClickedLayer.options.originalColor, weight: lastClickedLayer.options.originalWeight });
        }
        
        // Simpan gaya asli jika belum ada
        if (!layer.options.originalColor) {
            layer.options.originalColor = layer.options.color || 'blue';
            layer.options.originalWeight = layer.options.weight || 2;
        }

        // Terapkan Highlight (Kuning)
        if (layer.setStyle) {
            layer.setStyle({ color: '#ffeb3b', weight: 6 });
        }
        lastClickedLayer = layer;
    });

    if (feature.properties) {
        var content = "<div style='min-width:180px'><b>Detail Aset</b><hr>";
        for (var key in feature.properties) {
            content += `small><b>${key.toUpperCase()}:</b> ${feature.properties[key]}</small><br>`;
        }
        layer.bindPopup(content + "</div>");
    }
}

// 6. Memuat Data Sesuai Legenda Foto
// Site Location (Titik Biru)
fetch('data/proyek_infra2v1.json').then(res => res.json()).then(data => {
    L.geoJSON(data, {
        onEachFeature: onEachFeature,
        pointToLayer: (f, latlng) => L.circleMarker(latlng, { radius: 7, color: '#ff0000', fillColor: '#ff00d4', fillOpacity: 0.9 })
    }).addTo(layers.site);
});

// Bench Mark (Segitiga Merah - Custom Icon)
var bmIcon = L.divIcon({
    className: 'custom-icon',
    html: `<div style="width: 0; height: 0; border-left: 8px solid transparent; border-right: 8px solid transparent; border-bottom: 16px solid #e74c3c;"></div>`,
    iconSize: [16, 16], iconAnchor: [8, 16]
});
// Bench Mark (Ubah menjadi Kotak Biru)
fetch('data/bm_points.json').then(res => res.json()).then(data => {
    L.geoJSON(data, {
        onEachFeature: onEachFeature,
        pointToLayer: (f, latlng) => {
            // Membuat icon kotak menggunakan CSS
            var boxIcon = L.divIcon({
                className: 'custom-box-icon',
                html: `<div style="width: 14px; height: 14px; background-color: #007bff; border: 2px solid white; box-shadow: 0 0 3px rgba(0,0,0,0.5);"></div>`,
                iconSize: [14, 14],
                iconAnchor: [7, 7]
            });
            return L.marker(latlng, { 
                icon: boxIcon, 
                originalIcon: boxIcon // Penting agar saat highlight reset tetap jadi kotak biru
            });
        }
    }).addTo(layers.bm);
});

// Alinyemen (Garis Orange)
fetch('data/alinyemen.json').then(res => res.json()).then(data => {
    L.geoJSON(data, {
        onEachFeature: onEachFeature,
        style: { color: '#ff7800', weight: 4, originalColor: '#ff7800', originalWeight: 4 }
    }).addTo(layers.alinyemen);
});

// Area ROW (Polygon Hijau)
fetch('data/row_area.json').then(res => res.json()).then(data => {
    L.geoJSON(data, {
        onEachFeature: onEachFeature,
        style: { color: '#2ecc71', fillColor: '#2ecc71', fillOpacity: 0.4, weight: 2, originalColor: '#2ecc71', originalWeight: 2 }
    }).addTo(layers.row);
});

// 7. Logika Filter Legenda
// Pastikan kode ini diletakkan setelah inisialisasi objek 'layers'
document.querySelectorAll('.legend-item').forEach(item => {
    // Ubah kursor agar user tahu ini bisa diklik
    item.style.cursor = 'pointer';
    
    item.addEventListener('click', function() {
        // Ambil ID layer dari atribut data-layer
        var layerName = this.getAttribute('data-layer');
        
        if (layers[layerName]) {
            if (map.hasLayer(layers[layerName])) {
                // Jika layer sedang tampil -> SEMBUNYIKAN
                map.removeLayer(layers[layerName]);
                
                // Beri efek visual pada legenda (redup & coret teks)
                this.style.opacity = '0.3';
                this.style.textDecoration = 'line-through';
                this.style.transition = 'all 0.3s ease';
            } else {
                // Jika layer sedang sembunyi -> TAMPILKAN
                map.addLayer(layers[layerName]);
                
                // Kembalikan tampilan legenda ke normal
                this.style.opacity = '1';
                this.style.textDecoration = 'none';
            }
        }
    });
});

// 7. Tombol Home & Search Control Terintegrasi
var customControl = L.Control.extend({
    options: { position: 'topleft' },
    onAdd: function (map) {
        var container = L.DomUtil.create('div', 'leaflet-bar leaflet-control bg-white p-1');
        container.innerHTML = `
            <div style="display:flex; padding: 2px;">
                    <input type="text" id="search-input" placeholder="Cari..." style="width:120px; border:1px solid #ccc; padding:2px 5px; font-size:12px;">
                    <button id="search-btn" style="padding:2px 8px; cursor:pointer; background:#007bff; color:white; border:none; font-size:12px;">🔍</button>
            </div>
        `;
        
        L.DomEvent.disableClickPropagation(container);

        // Event Listener Search
        container.querySelector('#search-btn').onclick = () => { searchLocation(); };
        
        return container;
    }
});
map.addControl(new customControl());

// 8. Logika Filter Legenda
document.querySelectorAll('.legend-item').forEach(item => {
    item.addEventListener('click', function() {
        var layerName = this.getAttribute('data-layer');
        if (layers[layerName]) {
            if (map.hasLayer(layers[layerName])) {
                map.removeLayer(layers[layerName]);
                this.style.opacity = '0.3';
                this.style.textDecoration = 'line-through';
            } else {
                map.addLayer(layers[layerName]);
                this.style.opacity = '1';
                this.style.textDecoration = 'none';
            }
        }
    });
});

function searchLocation() {
    var query = document.getElementById('search-input').value.toLowerCase();
    var found = false;

    // Cari di semua layer yang aktif
    Object.keys(layers).forEach(key => {
        layers[key].eachLayer(layer => {
            if (layer.feature && layer.feature.properties) {
                var props = JSON.stringify(layer.feature.properties).toLowerCase();
                if (props.includes(query)) {
                    var latlng = layer.getBounds ? layer.getBounds().getCenter() : layer.getLatLng();
                    map.setView(latlng, 15);
                    layer.openPopup();
                    found = true;
                }
            }
        });
    });

    if (!found) alert("Aset tidak ditemukan dalam data saat ini.");
}