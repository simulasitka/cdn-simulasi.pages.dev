/**
 * Benchmark Data Loader
 * Handles AJAX fetch and display of benchmark data
 */

(function() {
    'use strict';
    
    // Wait for DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initBenchmark);
    } else {
        initBenchmark();
    }
    
    function initBenchmark() {
        const section = document.querySelector('.pd-benchmark-section');
        if (!section) return;
        
        const button = document.getElementById('btn-load-benchmark');
        const content = document.getElementById('benchmark-content');
        const productId = section.dataset.productId;
        
        if (!button || !content || !productId) return;
        
        let isLoading = false;
        let dataLoaded = false;
        
        button.addEventListener('click', function() {
            if (isLoading || dataLoaded) return;
            
            loadBenchmarkData(productId, button, content);
        });
    }
    
    function loadBenchmarkData(productId, button, container) {
        // Update button state
        button.disabled = true;
        button.classList.add('loading');
        const originalText = button.querySelector('.btn-text').textContent;
        button.querySelector('.btn-text').textContent = 'Memuat data...';
        
        // Show loading state
        container.style.display = 'block';
        container.innerHTML = `
            <div class="benchmark-loading">
                <div class="benchmark-loading-spinner"></div>
                <p>Mengambil data benchmark...</p>
            </div>
        `;
        
        // Fetch data
        fetch('/api/benchmark/fetch.php?product_id=' + productId)
            .then(function(response) {
                if (!response.ok) {
                    throw new Error('HTTP error ' + response.status);
                }
                return response.json();
            })
            .then(function(result) {
                if (result.success && result.data) {
                    renderBenchmarkData(result.data, container);
                    button.style.display = 'none'; // Hide button after successful load
                } else {
                    throw new Error(result.error || 'Data tidak tersedia');
                }
            })
            .catch(function(error) {
                console.error('Benchmark fetch error:', error);
                container.innerHTML = `
                    <div class="benchmark-error">
                        <p><strong>⚠️ Data Benchmark Tidak Tersedia</strong></p>
                        <p style="font-size: 14px; margin-top: 8px;">
                            ${error.message || 'Terjadi kesalahan saat memuat data'}
                        </p>
                        <button type="button" onclick="location.reload()" 
                                style="margin-top: 16px; padding: 8px 20px; background: #667eea; color: #fff; border: none; border-radius: 6px; cursor: pointer;">
                            Coba Lagi
                        </button>
                    </div>
                `;
                
                // Reset button
                button.disabled = false;
                button.classList.remove('loading');
                button.querySelector('.btn-text').textContent = originalText;
            });
    }
    
    function renderBenchmarkData(data, container) {
        let html = '<div class="benchmark-data-wrapper">';
        
        // Chipset info if available
        if (data.chipset) {
            html += `
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 10px 16px; border-radius: 8px; margin-bottom: 12px;">
                    <div style="font-size: 11px; opacity: 0.85; margin-bottom: 2px;">Chipset</div>
                    <div style="font-size: 15px; font-weight: 600;">${escapeHtml(data.chipset)}</div>
                </div>
            `;
        }
        
        // Main benchmark scores
        if (data.antutu || data.geekbench_multi || data.overall_score) {
            html += '<div class="benchmark-data-grid">';
            
            if (data.antutu) {
                html += `
                    <div class="benchmark-card">
                        <div class="benchmark-card-label">ANTUTU</div>
                        <div class="benchmark-card-value large">${formatNumber(data.antutu)}</div>
                        ${getScoreBadge(data.antutu, 'antutu')}
                    </div>
                `;
            }
            
            if (data.geekbench_multi) {
                html += `
                    <div class="benchmark-card">
                        <div class="benchmark-card-label">GEEKBENCH MULTI</div>
                        <div class="benchmark-card-value">${formatNumber(data.geekbench_multi)}</div>
                        ${data.geekbench_single ? '<div class="benchmark-card-subtitle">Single: ' + formatNumber(data.geekbench_single) + '</div>' : ''}
                    </div>
                `;
            }
            
            if (data.gaming_score) {
                html += `
                    <div class="benchmark-card">
                        <div class="benchmark-card-label">GAMING</div>
                        <div class="benchmark-card-value">${data.gaming_score}<span style="font-size: 14px; opacity: 0.6;">/100</span></div>
                    </div>
                `;
            }
            
            if (data.battery_score) {
                html += `
                    <div class="benchmark-card">
                        <div class="benchmark-card-label">BATTERY</div>
                        <div class="benchmark-card-value">${data.battery_score}<span style="font-size: 14px; opacity: 0.6;">/100</span></div>
                    </div>
                `;
            }
            
            if (data.overall_score) {
                html += `
                    <div class="benchmark-card">
                        <div class="benchmark-card-label">OVERALL</div>
                        <div class="benchmark-card-value">${data.overall_score}<span style="font-size: 14px; opacity: 0.6;">/100</span></div>
                    </div>
                `;
            }
            
            html += '</div>';
        }
        
        // AI Performance Description
        if (data.notes) {
            html += `
                <div style="background: #f8f9fa; border-left: 3px solid #667eea; padding: 10px 14px; border-radius: 6px; margin-top: 12px;">
                    <div style="font-size: 11px; font-weight: 600; color: #667eea; margin-bottom: 6px;">💡 Analisis Performa</div>
                    <div style="font-size: 13px; color: #4a5568; line-height: 1.5;">${escapeHtml(data.notes)}</div>
                </div>
            `;
        }
        
        // Attribution
        html += `
            <div class="benchmark-attribution">
                <p style="font-size: 11px; margin: 8px 0 0 0; color: #888;">Data benchmark dianalisis menggunakan AI dari spesifikasi produk</p>
                ${data.fetched_at ? '<p style="font-size: 10px; margin: 4px 0 0 0; color: #aaa;">Terakhir diperbarui: ' + formatDate(data.fetched_at) + '</p>' : ''}
            </div>
        `;
        
        html += '</div>';
        
        container.innerHTML = html;
    }
    
    function formatNumber(num) {
        if (!num) return '-';
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    }
    
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    function formatDate(dateStr) {
        try {
            const date = new Date(dateStr);
            const options = { year: 'numeric', month: 'long', day: 'numeric' };
            return date.toLocaleDateString('id-ID', options);
        } catch (e) {
            return dateStr;
        }
    }
    
    function getScoreBadge(score, type) {
        let category = '';
        let label = '';
        
        if (type === 'antutu') {
            if (score >= 500000) {
                category = 'excellent';
                label = 'Flagship';
            } else if (score >= 350000) {
                category = 'good';
                label = 'High-End';
            } else if (score >= 200000) {
                category = 'average';
                label = 'Mid-Range';
            } else {
                category = 'average';
                label = 'Entry-Level';
            }
        }
        
        if (label) {
            return '<div class="benchmark-score-badge ' + category + '">' + label + '</div>';
        }
        
        return '';
    }
})();