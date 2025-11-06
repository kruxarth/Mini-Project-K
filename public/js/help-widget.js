/**
 * AttendanceMS Help Widget
 * Floating help button for easy access to help system
 */

(function() {
    'use strict';

    // Create help widget HTML
    const helpWidgetHTML = `
        <div id="help-widget" style="
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 9999;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        ">
            <div id="help-button" style="
                width: 60px;
                height: 60px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4);
                transition: all 0.3s ease;
                color: white;
                font-size: 24px;
            ">
                <i class="fas fa-question-circle"></i>
            </div>
            
            <div id="help-menu" style="
                position: absolute;
                bottom: 70px;
                right: 0;
                background: white;
                border-radius: 12px;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
                padding: 1rem;
                min-width: 250px;
                display: none;
                border: 1px solid #e9ecef;
            ">
                <div style="margin-bottom: 1rem;">
                    <h6 style="margin: 0; color: #2d3748; font-weight: 600;">
                        <i class="fas fa-question-circle" style="color: #667eea; margin-right: 0.5rem;"></i>
                        Need Help?
                    </h6>
                </div>
                
                <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                    <a href="/help/getting-started" style="
                        display: flex;
                        align-items: center;
                        padding: 0.5rem;
                        color: #4a5568;
                        text-decoration: none;
                        border-radius: 6px;
                        transition: all 0.2s ease;
                        font-size: 14px;
                    " onmouseover="this.style.background='#f7fafc'" onmouseout="this.style.background='transparent'">
                        <i class="fas fa-rocket" style="width: 16px; margin-right: 0.75rem; color: #667eea;"></i>
                        Getting Started
                    </a>
                    
                    <a href="/help/faq" style="
                        display: flex;
                        align-items: center;
                        padding: 0.5rem;
                        color: #4a5568;
                        text-decoration: none;
                        border-radius: 6px;
                        transition: all 0.2s ease;
                        font-size: 14px;
                    " onmouseover="this.style.background='#f7fafc'" onmouseout="this.style.background='transparent'">
                        <i class="fas fa-question" style="width: 16px; margin-right: 0.75rem; color: #667eea;"></i>
                        FAQs
                    </a>
                    
                    <a href="/help/how-to" style="
                        display: flex;
                        align-items: center;
                        padding: 0.5rem;
                        color: #4a5568;
                        text-decoration: none;
                        border-radius: 6px;
                        transition: all 0.2s ease;
                        font-size: 14px;
                    " onmouseover="this.style.background='#f7fafc'" onmouseout="this.style.background='transparent'">
                        <i class="fas fa-tasks" style="width: 16px; margin-right: 0.75rem; color: #667eea;"></i>
                        How-To Guides
                    </a>
                    
                    <a href="/help/troubleshooting" style="
                        display: flex;
                        align-items: center;
                        padding: 0.5rem;
                        color: #4a5568;
                        text-decoration: none;
                        border-radius: 6px;
                        transition: all 0.2s ease;
                        font-size: 14px;
                    " onmouseover="this.style.background='#f7fafc'" onmouseout="this.style.background='transparent'">
                        <i class="fas fa-tools" style="width: 16px; margin-right: 0.75rem; color: #667eea;"></i>
                        Troubleshooting
                    </a>
                    
                    <hr style="margin: 0.5rem 0; border: none; border-top: 1px solid #e9ecef;">
                    
                    <a href="/help/contact" style="
                        display: flex;
                        align-items: center;
                        padding: 0.5rem;
                        color: #4a5568;
                        text-decoration: none;
                        border-radius: 6px;
                        transition: all 0.2s ease;
                        font-size: 14px;
                        font-weight: 600;
                    " onmouseover="this.style.background='#f0f8ff'" onmouseout="this.style.background='transparent'">
                        <i class="fas fa-headset" style="width: 16px; margin-right: 0.75rem; color: #28a745;"></i>
                        Contact Support
                    </a>
                    
                    <a href="/help" style="
                        display: flex;
                        align-items: center;
                        padding: 0.5rem;
                        color: #667eea;
                        text-decoration: none;
                        border-radius: 6px;
                        transition: all 0.2s ease;
                        font-size: 14px;
                        font-weight: 600;
                    " onmouseover="this.style.background='#f0f8ff'" onmouseout="this.style.background='transparent'">
                        <i class="fas fa-external-link-alt" style="width: 16px; margin-right: 0.75rem;"></i>
                        Help Center
                    </a>
                </div>
            </div>
        </div>
    `;

    // Initialize help widget when DOM is ready
    function initHelpWidget() {
        // Don't show on help pages themselves
        if (window.location.pathname.startsWith('/help')) {
            return;
        }

        // Insert widget HTML
        document.body.insertAdjacentHTML('beforeend', helpWidgetHTML);

        const helpButton = document.getElementById('help-button');
        const helpMenu = document.getElementById('help-menu');
        let isMenuOpen = false;

        // Button hover effects
        helpButton.addEventListener('mouseenter', function() {
            this.style.transform = 'scale(1.1)';
            this.style.boxShadow = '0 6px 25px rgba(102, 126, 234, 0.6)';
        });

        helpButton.addEventListener('mouseleave', function() {
            if (!isMenuOpen) {
                this.style.transform = 'scale(1)';
                this.style.boxShadow = '0 4px 20px rgba(102, 126, 234, 0.4)';
            }
        });

        // Toggle menu
        helpButton.addEventListener('click', function(e) {
            e.stopPropagation();
            isMenuOpen = !isMenuOpen;
            
            if (isMenuOpen) {
                helpMenu.style.display = 'block';
                helpMenu.style.animation = 'fadeInUp 0.3s ease';
                helpButton.style.transform = 'scale(1.1)';
                helpButton.style.boxShadow = '0 6px 25px rgba(102, 126, 234, 0.6)';
            } else {
                helpMenu.style.display = 'none';
                helpButton.style.transform = 'scale(1)';
                helpButton.style.boxShadow = '0 4px 20px rgba(102, 126, 234, 0.4)';
            }
        });

        // Close menu when clicking outside
        document.addEventListener('click', function() {
            if (isMenuOpen) {
                isMenuOpen = false;
                helpMenu.style.display = 'none';
                helpButton.style.transform = 'scale(1)';
                helpButton.style.boxShadow = '0 4px 20px rgba(102, 126, 234, 0.4)';
            }
        });

        // Prevent menu clicks from closing the menu
        helpMenu.addEventListener('click', function(e) {
            e.stopPropagation();
        });

        // Add CSS animations
        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeInUp {
                from {
                    opacity: 0;
                    transform: translateY(10px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            
            #help-widget {
                user-select: none;
            }
            
            @media (max-width: 768px) {
                #help-widget {
                    bottom: 15px;
                    right: 15px;
                }
                
                #help-button {
                    width: 50px;
                    height: 50px;
                    font-size: 20px;
                }
                
                #help-menu {
                    bottom: 60px;
                    min-width: 220px;
                }
            }
        `;
        document.head.appendChild(style);

        // Keyboard shortcut (Ctrl + H)
        document.addEventListener('keydown', function(e) {
            if (e.ctrlKey && e.key === 'h') {
                e.preventDefault();
                window.location.href = '/help';
            }
        });
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initHelpWidget);
    } else {
        initHelpWidget();
    }
})();