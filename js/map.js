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

// 4. Manajemen Layer (Global untuk Filter)
var layers = {
    site: L.layerGroup().addTo(map),
    bm: L.layerGroup().addTo(map),
    sta: L.layerGroup().addTo(map),
    alinyemen: L.layerGroup().addTo(map),
    row: L.layerGroup().addTo(map)
};

// 5. Tombol Home (Pojok Kiri Atas)
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

// 6. Fungsi Interaksi & Highlight
var lastClickedLayer = null;

function onEachFeature(feature, layer) {
    layer.on('click', function (e) {
        if (lastClickedLayer && lastClickedLayer.setStyle) {
            lastClickedLayer.setStyle({ 
                color: lastClickedLayer.options.originalColor, 
                weight: lastClickedLayer.options.originalWeight 
            });
        }
        
        if (!layer.options.originalColor) {
            layer.options.originalColor = layer.options.color || '#007bff';
            layer.options.originalWeight = layer.options.weight || 2;
        }

        if (layer.setStyle) {
            layer.setStyle({ color: '#ffeb3b', weight: 6 });
        }
        lastClickedLayer = layer;
    });

    if (feature.properties) {
        // Koreksi tag <small> agar tampilan atribut rapi
        var content = "<div style='min-width:200px; font-family:Arial;'><b>Detail Aset</b><hr style='margin:5px 0;'>";
        for (var key in feature.properties) {
            content += `<small><b>${key.toUpperCase()}:</b> ${feature.properties[key]}</small><br>`;
        }
        layer.bindPopup(content + "</div>");
    }
}

// 7. Memuat Data Sesuai Legenda
// Area ROW (Polygon Hijau)
fetch('data/row_area.json').then(res => res.json()).then(data => {
    L.geoJSON(data, {
        onEachFeature: onEachFeature,
        style: { color: '#2ecc71', fillColor: '#2ecc71', fillOpacity: 0.4, weight: 2, originalColor: '#2ecc71', originalWeight: 2 }
    }).addTo(layers.row);
});

// Bench Mark (Kotak Biru)
fetch('data/bm_points.json').then(res => res.json()).then(data => {
    L.geoJSON(data, {
        onEachFeature: onEachFeature,
        pointToLayer: (f, latlng) => {
            var boxIcon = L.divIcon({
                className: 'custom-box-icon',
                html: `<div style="width: 14px; height: 14px; background-color: #007bff; border: 2px solid white; box-shadow: 0 0 3px rgba(0,0,0,0.5);"></div>`,
                iconSize: [14, 14],
                iconAnchor: [7, 7]
            });
            return L.marker(latlng, { icon: boxIcon, originalIcon: boxIcon });
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

// Site Location (Titik Merah - Sesuai Proyek Waskita)
fetch('data/proyek_infra2v1.json').then(res => res.json()).then(data => {
    L.geoJSON(data, {
        onEachFeature: onEachFeature,
        pointToLayer: (f, latlng) => L.circleMarker(latlng, { radius: 7, color: '#ffffff', fillColor: '#ff0000', fillOpacity: 0.9, weight: 2 })
    }).addTo(layers.site);
});


// 8. Logika Filter Legenda Terpusat
document.querySelectorAll('.legend-item').forEach(item => {
    item.style.cursor = 'pointer';
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

// --- 9. TOMBOL SEARCH CONTROL (Mencari Teks Atribut Layer) ---
var searchControl = L.Control.extend({
    options: { position: 'topleft' }, // Posisi di kiri atas, di bawah tombol Home
    onAdd: function (map) {
        var container = L.DomUtil.create('div', 'leaflet-bar leaflet-control bg-white p-1');
        
        // Desain UI Input dan Tombol
        container.innerHTML = `
            <div style="display:flex; padding: 2px; align-items: center;">
                <input type="text" id="search-input" placeholder="Cari atribut..." 
                       style="width:140px; border:1px solid #ccc; padding:4px 6px; font-size:12px; border-radius:3px 0 0 3px; outline:none;">
                <button id="search-btn" title="Cari Data" 
                        style="padding:4px 8px; cursor:pointer; background:#007bff; color:white; border:none; font-size:12px; border-radius:0 3px 3px 0;">🔍</button>
            </div>
        `;
        
        // Mencegah klik di kotak pencarian agar tidak "tembus" ke peta di bawahnya
        L.DomEvent.disableClickPropagation(container);

        // Eksekusi pencarian saat tombol diklik
        container.querySelector('#search-btn').onclick = function() {
            executeSearch();
        };
        
        // Eksekusi pencarian saat menekan tombol "Enter" di keyboard
        container.querySelector('#search-input').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                executeSearch();
            }
        });

        return container;
    }
});
map.addControl(new searchControl());

// --- 10. LOGIKA EKSEKUSI PENCARIAN (REVISI HIERARKI LAYER) ---
function executeSearch() {
    var input = document.getElementById('search-input').value.toLowerCase();
    if (!input) return; // Abaikan jika kotak pencarian kosong

    var found = false;

    // Looping semua grup layer (site, bm, sta, dll)
    Object.keys(layers).forEach(function(key) {
        
        // Cek isi dari setiap grup layer
        layers[key].eachLayer(function(geoJsonGroup) {
            
            // Karena data berupa GeoJSON, kita harus masuk satu tingkat lagi ke dalam titik/garisnya
            if (geoJsonGroup.eachLayer) {
                geoJsonGroup.eachLayer(function(layer) {
                    
                    if (layer.feature && layer.feature.properties) {
                        // Ubah semua atribut menjadi teks huruf kecil
                        var propsText = JSON.stringify(layer.feature.properties).toLowerCase();
                        
                        // Jika kata kunci ditemukan
                        if (propsText.includes(input)) {
                            
                            // 1. Nyalakan layer jika sedang disembunyikan oleh filter
                            if (!map.hasLayer(layers[key])) {
                                map.addLayer(layers[key]);
                                var legendItem = document.querySelector('.legend-item[data-layer="' + key + '"]');
                                if (legendItem) {
                                    legendItem.style.opacity = '1';
                                    legendItem.style.textDecoration = 'none';
                                }
                            }

                            // 2. Arahkan kamera ke aset yang ditemukan
                            if (layer.getBounds) {
                                // Untuk Polygon/Garis
                                map.fitBounds(layer.getBounds()); 
                            } else if (layer.getLatLng) {
                                // Untuk Titik (Marker)
                                map.setView(layer.getLatLng(), 15); 
                            }
                            
                            // 3. Buka popup informasi
                            layer.openPopup();
                            
                            // 4. Highlight warna kuning (memanfaatkan logika highlight yang sudah kita buat)
                            layer.fire('click'); 

                            found = true;
                        }
                    }
                });
            }
        });
    });

    if (!found) {
        alert("Data dengan kata kunci '" + input + "' tidak ditemukan.");
    }
}