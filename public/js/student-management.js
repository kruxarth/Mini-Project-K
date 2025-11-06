// Student Management JavaScript
class StudentManager {
    constructor(classId) {
        this.classId = classId;
        this.currentStudentId = null;
        this.students = [];
        this.filteredStudents = [];
        
        this.initializeEventListeners();
        this.loadStudents();
    }
    
    initializeEventListeners() {
        // Search input
        document.getElementById('searchInput').addEventListener('input', () => {
            this.applyFilters();
        });
        
        // Status filter
        document.getElementById('statusFilter').addEventListener('change', () => {
            this.applyFilters();
        });
        
        // Sort by
        document.getElementById('sortBy').addEventListener('change', () => {
            this.applyFilters();
        });
        
        // Form submission
        document.getElementById('studentForm').addEventListener('submit', (e) => {
            this.handleFormSubmit(e);
        });
        
        // Modal close on outside click
        window.addEventListener('click', (event) => {
            const modal = document.getElementById('studentModal');
            if (event.target === modal) {
                this.closeModal();
            }
        });
    }
    
    async loadStudents() {
        try {
            // For now, we'll work with the server-rendered data
            // In a full implementation, this would fetch from API
            this.students = this.getStudentsFromDOM();
            this.filteredStudents = [...this.students];
            this.renderStudents();
        } catch (error) {
            console.error('Error loading students:', error);
            this.showNotification('Error loading students', 'error');
        }
    }
    
    getStudentsFromDOM() {
        const studentCards = document.querySelectorAll('.student-card');
        return Array.from(studentCards).map(card => ({
            id: parseInt(card.dataset.studentId),
            element: card
        }));
    }
    
    openAddModal() {
        document.getElementById('modalTitle').textContent = 'Add New Student';
        document.getElementById('studentForm').reset();
        this.currentStudentId = null;
        document.getElementById('studentModal').style.display = 'block';
    }
    
    async editStudent(studentId) {
        try {
            this.currentStudentId = studentId;
            document.getElementById('modalTitle').textContent = 'Edit Student';
            
            // Fetch student data
            const response = await fetch(`/api/class/${this.classId}/students/${studentId}`);
            if (!response.ok) throw new Error('Failed to fetch student data');
            
            const student = await response.json();
            this.populateForm(student);
            
            document.getElementById('studentModal').style.display = 'block';
        } catch (error) {
            console.error('Error loading student data:', error);
            this.showNotification('Error loading student data', 'error');
        }
    }
    
    populateForm(student) {
        document.getElementById('studentName').value = student.name || '';
        document.getElementById('rollNo').value = student.roll_no || '';
        document.getElementById('studentEmail').value = student.email || '';
        document.getElementById('studentPhone').value = student.phone || '';
        document.getElementById('dateOfBirth').value = student.date_of_birth || '';
        document.getElementById('enrollmentStatus').value = student.enrollment_status || 'active';
        document.getElementById('academicYear').value = student.academic_year || '';
        document.getElementById('branch').value = student.branch || '';
        document.getElementById('address').value = student.address || '';
        document.getElementById('guardianName').value = student.guardian_name || '';
        document.getElementById('guardianEmail').value = student.guardian_email || '';
        document.getElementById('guardianPhone').value = student.guardian_phone || '';
        document.getElementById('emergencyContact').value = student.emergency_contact || '';
        document.getElementById('notes').value = student.notes || '';
    }
    
    closeModal() {
        document.getElementById('studentModal').style.display = 'none';
        this.currentStudentId = null;
    }
    
    async handleFormSubmit(e) {
        e.preventDefault();
        
        const formData = {
            student_id: this.currentStudentId,
            name: document.getElementById('studentName').value,
            roll_no: document.getElementById('rollNo').value,
            email: document.getElementById('studentEmail').value,
            phone: document.getElementById('studentPhone').value,
            date_of_birth: document.getElementById('dateOfBirth').value,
            enrollment_status: document.getElementById('enrollmentStatus').value,
            academic_year: document.getElementById('academicYear').value,
            branch: document.getElementById('branch').value,
            address: document.getElementById('address').value,
            guardian_name: document.getElementById('guardianName').value,
            guardian_email: document.getElementById('guardianEmail').value,
            guardian_phone: document.getElementById('guardianPhone').value,
            emergency_contact: document.getElementById('emergencyContact').value,
            notes: document.getElementById('notes').value
        };
        
        try {
            const response = await fetch(`/class/${this.classId}/students/save`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showNotification(result.message, 'success');
                this.closeModal();
                // Reload the page to show updated data
                window.location.reload();
            } else {
                this.showNotification(result.error || 'Failed to save student', 'error');
            }
        } catch (error) {
            console.error('Error saving student:', error);
            this.showNotification('Error saving student', 'error');
        }
    }
    
    async deleteStudent(studentId, studentName) {
        if (!confirm(`Are you sure you want to delete ${studentName}? This action cannot be undone.`)) {
            return;
        }
        
        try {
            const response = await fetch(`/class/${this.classId}/students/${studentId}/delete`, {
                method: 'POST'
            });
            
            if (response.ok) {
                this.showNotification('Student deleted successfully', 'success');
                // Remove the student card from DOM
                const studentCard = document.querySelector(`[data-student-id="${studentId}"]`);
                if (studentCard) {
                    studentCard.remove();
                }
            } else {
                this.showNotification('Failed to delete student', 'error');
            }
        } catch (error) {
            console.error('Error deleting student:', error);
            this.showNotification('Error deleting student', 'error');
        }
    }
    
    viewAttendance(studentId) {
        // Navigate to student attendance view
        window.location.href = `/class/${this.classId}/student/${studentId}/attendance`;
    }
    
    exportStudents() {
        // Download CSV export
        window.location.href = `/class/${this.classId}/students/export`;
    }
    
    bulkImport() {
        // TODO: Implement bulk import functionality
        this.showNotification('Bulk import feature coming soon!', 'info');
    }
    
    applyFilters() {
        const search = document.getElementById('searchInput').value.toLowerCase();
        const status = document.getElementById('statusFilter').value;
        const sortBy = document.getElementById('sortBy').value;
        
        const studentCards = document.querySelectorAll('.student-card');
        
        studentCards.forEach(card => {
            const studentName = card.querySelector('.student-name').textContent.toLowerCase();
            const studentRoll = card.querySelector('.student-roll').textContent.toLowerCase();
            const studentStatus = card.querySelector('.status-badge').textContent.toLowerCase();
            
            // Apply search filter
            const matchesSearch = !search || 
                studentName.includes(search) || 
                studentRoll.includes(search);
            
            // Apply status filter
            const matchesStatus = !status || studentStatus.includes(status);
            
            // Show/hide card based on filters
            if (matchesSearch && matchesStatus) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        });
        
        // TODO: Implement sorting
        if (sortBy) {
            console.log('Sorting by:', sortBy);
        }
    }
    
    renderStudents() {
        // This method would be used if we were dynamically rendering students
        // For now, we're using server-side rendering
    }
    
    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <span>${message}</span>
            <button onclick="this.parentElement.remove()">&times;</button>
        `;
        
        // Add styles
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 8px;
            color: white;
            font-weight: 500;
            z-index: 10000;
            display: flex;
            align-items: center;
            gap: 10px;
            min-width: 300px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;
        
        // Set background color based on type
        const colors = {
            success: '#4CAF50',
            error: '#f44336',
            warning: '#FF9800',
            info: '#2196F3'
        };
        notification.style.background = colors[type] || colors.info;
        
        // Add to page
        document.body.appendChild(notification);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }
}

// Global functions for onclick handlers
let studentManager;

function openAddModal() {
    studentManager.openAddModal();
}

function editStudent(studentId) {
    studentManager.editStudent(studentId);
}

function closeModal() {
    studentManager.closeModal();
}

function deleteStudent(studentId, studentName) {
    studentManager.deleteStudent(studentId, studentName);
}

function viewAttendance(studentId) {
    studentManager.viewAttendance(studentId);
}

function exportStudents() {
    studentManager.exportStudents();
}

function bulkImport() {
    studentManager.bulkImport();
}

function applyFilters() {
    studentManager.applyFilters();
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    // Get class ID from URL or data attribute
    const classId = window.location.pathname.match(/\/class\/(\d+)/)?.[1];
    if (classId) {
        studentManager = new StudentManager(classId);
    }
});