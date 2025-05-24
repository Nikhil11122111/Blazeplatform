class MajorSubCategoryDropdown {
    constructor(containerId, onChange) {
        console.log('Initializing MajorSubCategoryDropdown with containerId:', containerId);
        this.container = document.getElementById(containerId);
        this.onChange = onChange;
        this.selectedValue = '';
        this.isCustomInput = false;
        
        // Options data structure with enum values
        this.options = {
            'Engineering': [
                { label: 'Aero', value: 'AERO' },
                { label: 'Mech', value: 'MECH' },
                { label: 'Software', value: 'SOFTWARE' },
                { label: 'Environmental', value: 'ENVIRONMENTAL' },
                { label: 'Architectural', value: 'ARCHITECTURAL' },
                { label: 'Civil', value: 'CIVIL' },
                { label: 'Design', value: 'DESIGN' },
                { label: 'Chemical', value: 'CHEMICAL' },
                { label: 'Bio Med', value: 'BIO_MED' },
                { label: 'Other Engineering', value: 'OTHER_ENGINEERING' }
            ],
            'Science': [
                { label: 'Computer Science', value: 'COMPUTER_SCIENCE' },
                { label: 'Health Science', value: 'HEALTH_SCIENCE' },
                { label: 'Bio Med', value: 'BIO_MED' },
                { label: 'Data Science', value: 'DATA_SCIENCE' },
                { label: 'Other Science', value: 'OTHER_SCIENCE' }
            ],
            'Business': [
                { label: 'Finance', value: 'FINANCE' },
                { label: 'Marketing', value: 'MARKETING' },
                { label: 'Management', value: 'MANAGEMENT' },
                { label: 'Accounting', value: 'ACCOUNTING' },
                { label: 'Economics', value: 'ECONOMICS' },
                { label: 'Other Business', value: 'OTHER_BUSINESS' }
            ],
            'Arts': [
                { label: 'Fine Arts', value: 'FINE_ARTS' },
                { label: 'Design', value: 'DESIGN' },
                { label: 'Music', value: 'MUSIC' },
                { label: 'Theater', value: 'THEATER' },
                { label: 'Other Arts', value: 'OTHER_ARTS' }
            ],
            'Other': [
                { label: 'Custom Major', value: 'CUSTOM_MAJOR' }
            ]
        };
        
        this.init();
    }
    
    init() {
        // Create main container
        this.dropdownContainer = document.createElement('div');
        this.dropdownContainer.className = 'major-subcategory-container';
        
        // Create input field
        this.input = document.createElement('input');
        this.input.type = 'text';
        this.input.className = 'major-subcategory-input form-control';
        this.input.placeholder = 'Select or type major sub-category';
        this.input.readOnly = false;
        
        // Create dropdown
        this.dropdown = document.createElement('div');
        this.dropdown.className = 'major-subcategory-dropdown';
        
        // Create custom input message
        this.customInputMessage = document.createElement('div');
        this.customInputMessage.className = 'custom-input-message';
        this.customInputMessage.textContent = 'Type your custom value and press Enter';
        
        // Add elements to container
        this.dropdownContainer.appendChild(this.input);
        this.dropdownContainer.appendChild(this.dropdown);
        this.dropdownContainer.appendChild(this.customInputMessage);
        this.container.appendChild(this.dropdownContainer);
        
        // Add event listeners
        this.addEventListeners();
        
        // Initialize options
        this.updateOptions();
        
        // Try to load saved value
        this.loadSavedValue();
    }
    
    loadSavedValue() {
        console.log('Loading saved value...');
        
        const hiddenInput = document.getElementById('major-sub-category-input');
        
        if (!hiddenInput) {
            console.log('No hidden input found');
            return;
        }
        
        const value = hiddenInput.value;
        const customValue = hiddenInput.getAttribute('data-custom');
        
        console.log('Found values:', { value, customValue });
        
        if (!value) {
            console.log('No value to load');
            return;
        }
        
        // Find the major category
        let foundMajor = null;
        let matchingItem = null;
        
        if (value.startsWith('CUSTOM_')) {
            const majorPart = value.replace('CUSTOM_', '');
            foundMajor = Object.keys(this.options).find(
                major => majorPart === major.toUpperCase()
            );
            console.log('Found major for custom value:', foundMajor);
        } else {
            for (const [major, items] of Object.entries(this.options)) {
                matchingItem = items.find(item => item.value === value);
                if (matchingItem) {
                    foundMajor = major;
                    break;
                }
            }
            console.log('Found major for standard value:', foundMajor);
        }
        
        if (!foundMajor) {
            console.log('Could not find matching major category');
            return;
        }
        
        // Set the major category
        const majorSelect = document.getElementById('major-select');
        if (majorSelect) {
            console.log('Setting major select to:', foundMajor);
            majorSelect.value = foundMajor;
            
            // Manually trigger change event
            const event = new Event('change', { bubbles: true });
            majorSelect.dispatchEvent(event);
        }
        
        // Set the value after a short delay to ensure options are updated
        setTimeout(() => {
            if (value.startsWith('CUSTOM_')) {
                console.log('Setting custom value:', customValue);
                this.isCustomInput = true;
                this.selectedValue = value;
                this.input.readOnly = false;
                this.input.value = customValue || '';
                this.input.placeholder = 'Type your custom value';
                this.customInputMessage.classList.add('show');
            } else if (matchingItem) {
                console.log('Setting standard value:', matchingItem.label);
                this.isCustomInput = false;
                this.selectedValue = value;
                this.input.readOnly = false;
                this.input.value = matchingItem.label;
                
                // Update selection in dropdown
                const items = this.dropdown.querySelectorAll('.major-subcategory-item');
                items.forEach(element => {
                    element.classList.toggle('selected', element.dataset.value === value);
                });
            }
            
            // Update hidden input to ensure it's in sync
            if (hiddenInput) {
                hiddenInput.value = value;
                if (customValue) {
                    hiddenInput.setAttribute('data-custom', customValue);
                } else {
                    hiddenInput.removeAttribute('data-custom');
                }
            }
            
            // Get major type value
            const majorTypeSelect = document.getElementById('major-type-select');
            const majorType = majorTypeSelect ? majorTypeSelect.value : null;
            
            // Trigger onChange callback
            if (this.onChange) {
                this.onChange({
                    value: value,
                    custom: customValue || null,
                    majorType: majorType
                });
            }
            
            console.log('Finished setting value');
        }, 100);
    }
    
    updateOptions() {
        const selectedMajor = document.getElementById('major-select')?.value;
        console.log('Updating options for major:', selectedMajor, 'Current selected value:', this.selectedValue);
        
        // Clear dropdown
        this.dropdown.innerHTML = '';
        
        if (selectedMajor && this.options[selectedMajor]) {
            const items = this.options[selectedMajor];
            
            // Add "Type custom value" option at the top
            const customOption = document.createElement('div');
            customOption.className = 'major-subcategory-item major-subcategory-custom-option';
            customOption.textContent = 'Type custom value';
            customOption.addEventListener('click', () => this.enableCustomInput());
            this.dropdown.appendChild(customOption);
            
            // Add divider
            const divider = document.createElement('div');
            divider.className = 'major-subcategory-divider';
            this.dropdown.appendChild(divider);
            
            // Add predefined options
            items.forEach(item => {
                const itemElement = document.createElement('div');
                itemElement.className = 'major-subcategory-item';
                itemElement.textContent = item.label;
                itemElement.dataset.value = item.value;
                
                // Check if this item is selected
                const isSelected = item.value === this.selectedValue;
                if (isSelected) {
                    itemElement.classList.add('selected');
                    console.log('Marking item as selected:', item.label);
                    
                    // Also update the input field to show the selected value
                    this.input.value = item.label;
                    this.input.readOnly = true;
                }
                
                itemElement.addEventListener('click', () => {
                    // Remove selected class from all items
                    this.dropdown.querySelectorAll('.major-subcategory-item').forEach(el => {
                        el.classList.remove('selected');
                    });
                    
                    // Add selected class to clicked item
                    itemElement.classList.add('selected');
                    
                    this.handleItemSelect(item);
                });
                
                this.dropdown.appendChild(itemElement);
            });
            
            // If we have a custom value for this major, show it as selected
            if (this.isCustomInput && this.selectedValue.startsWith(`CUSTOM_${selectedMajor.toUpperCase()}`)) {
                customOption.classList.add('selected');
                this.input.readOnly = false;
                this.customInputMessage.classList.add('show');
            }
        }
        
        console.log('Finished updating options, selected value is:', this.selectedValue);
    }
    
    enableCustomInput() {
        this.isCustomInput = true;
        this.input.value = '';
        this.input.readOnly = false;
        this.input.placeholder = 'Type your custom value';
        this.input.focus();
        this.customInputMessage.classList.add('show');
        this.dropdown.classList.remove('show');
    }
    
    handleItemSelect(item) {
        console.log('Handling item selection:', item);
        this.selectedValue = item.value;
        this.isCustomInput = false;
        this.input.value = item.label;
        this.input.readOnly = false;
        this.customInputMessage.classList.remove('show');
        
        // Update hidden input
        const hiddenInput = document.getElementById('major-sub-category-input');
        if (hiddenInput) {
            hiddenInput.value = item.value;
            hiddenInput.removeAttribute('data-custom');
        }
        
        // Hide dropdown
        this.dropdown.classList.remove('show');
        
        // Trigger onChange with major type
        if (this.onChange) {
            this.onChange({
                value: item.value,
                custom: null,
                majorType: this.majorTypeSelect ? this.majorTypeSelect.value : null
            });
        }
    }
    
    addEventListeners() {
        // Show dropdown on input click or focus
        this.input.addEventListener('click', () => {
            this.dropdown.classList.add('show');
        });

        this.input.addEventListener('focus', () => {
            this.dropdown.classList.add('show');
            if (this.isCustomInput) {
                this.customInputMessage.classList.add('show');
            }
        });
        
        // Handle input changes
        this.input.addEventListener('input', (e) => {
            const value = e.target.value.trim();
            if (value) {
                // Enable custom input mode
                this.isCustomInput = true;
                this.customInputMessage.classList.add('show');
                this.dropdown.classList.remove('show');
            } else {
                // Show dropdown for empty input
                this.dropdown.classList.add('show');
                this.customInputMessage.classList.remove('show');
            }
        });
        
        // Handle custom input
        this.input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const customValue = this.input.value.trim();
                if (customValue) {
                    this.customInputMessage.classList.remove('show');
                    
                    // Get the current major category
                    const selectedMajor = document.getElementById('major-select')?.value;
                    if (!selectedMajor) {
                        showToast('Please select a major category first', 'error');
                        return;
                    }
                    
                    const customEnumValue = `CUSTOM_${selectedMajor.toUpperCase()}`;
                    this.selectedValue = customEnumValue;
                    
                    // Update hidden input
                    const hiddenInput = document.getElementById('major-sub-category-input');
                    if (hiddenInput) {
                        hiddenInput.value = customEnumValue;
                        hiddenInput.setAttribute('data-custom', customValue);
                    }
                    
                    // Trigger onChange
                    if (this.onChange) {
                        this.onChange({
                            value: customEnumValue,
                            custom: customValue
                        });
                    }
                }
            }
        });
        
        // Handle input blur with delay
        this.input.addEventListener('blur', () => {
            setTimeout(() => {
                if (!this.dropdown.contains(document.activeElement)) {
                    this.dropdown.classList.remove('show');
                }
            }, 200);
        });
        
        // Listen for major category changes
        document.getElementById('major-select')?.addEventListener('change', () => {
            const currentValue = this.selectedValue;
            const currentCustomValue = this.isCustomInput ? this.input.value : null;
            
            // Only clear if the value doesn't belong to the new major
            const selectedMajor = document.getElementById('major-select')?.value;
            if (selectedMajor && this.options[selectedMajor]) {
                const items = this.options[selectedMajor];
                const valueExists = items.some(item => item.value === currentValue) || 
                                  (currentValue && currentValue.startsWith(`CUSTOM_${selectedMajor.toUpperCase()}`));
                
                if (!valueExists) {
                    this.clear();
                }
            } else {
                this.clear();
            }
            
            this.updateOptions();
            this.dropdown.classList.add('show');
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!this.dropdownContainer.contains(e.target)) {
                this.dropdown.classList.remove('show');
            }
        });
    }
    
    getValue() {
        return {
            value: this.selectedValue,
            custom: this.isCustomInput ? this.input.value.trim() : null
        };
    }
    
    setValue(value, customValue) {
        console.log('Setting value:', { value, customValue });
        
        if (!value) {
            this.clear();
            return;
        }

        this.selectedValue = value;
        
        // Check if this is a custom value
        if (value.startsWith('CUSTOM_')) {
            this.isCustomInput = true;
            this.input.readOnly = false;
            this.input.value = customValue || '';
            this.input.placeholder = 'Type your custom value';
            
            // Update hidden input
            const hiddenInput = document.getElementById('major-sub-category-input');
            if (hiddenInput) {
                hiddenInput.value = value;
                if (customValue) {
                    hiddenInput.setAttribute('data-custom', customValue);
                }
            }
            
            // Update the dropdown options
            this.updateOptions();
        } else {
            // Find which major category this value belongs to
            let foundMajor = null;
            let matchingItem = null;
            
            for (const [major, items] of Object.entries(this.options)) {
                matchingItem = items.find(item => item.value === value);
                if (matchingItem) {
                    foundMajor = major;
                    break;
                }
            }
            
            // If we found the major category, set it first
            if (foundMajor) {
                const majorSelect = document.getElementById('major-select');
                if (majorSelect && majorSelect.value !== foundMajor) {
                    majorSelect.value = foundMajor;
                    // Update options without clearing the current value
                    this.updateOptions();
                }
                
                this.isCustomInput = false;
                this.input.readOnly = true;
                this.input.value = matchingItem.label;
                this.input.placeholder = 'Select or type major sub-category';
                
                // Update hidden input
                const hiddenInput = document.getElementById('major-sub-category-input');
                if (hiddenInput) {
                    hiddenInput.value = value;
                    hiddenInput.removeAttribute('data-custom');
                }
                
                // Update the dropdown options to show the correct selected state
                this.updateOptions();
            }
        }
    }
    
    clear() {
        this.selectedValue = '';
        this.isCustomInput = false;
        this.input.value = '';
        this.input.readOnly = true;
        this.input.placeholder = 'Select or type major sub-category';
        this.customInputMessage.classList.remove('show');
        
        // Clear hidden input
        const hiddenInput = document.getElementById('major-sub-category-input');
        if (hiddenInput) {
            hiddenInput.value = '';
            hiddenInput.removeAttribute('data-custom');
        }
        
        this.updateOptions();
    }
} 