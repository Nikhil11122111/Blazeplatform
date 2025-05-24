// Address Handler Module
const AddressHandler = {
    // State to track if data is loaded
    isDataLoaded: false,
    addressData: null,

    // Initialize the address handler
    init() {
        console.log('Initializing AddressHandler');
        this.setupEventListeners();
        this.fetchAddressData();

        // Add a retry mechanism for initial population
        setTimeout(() => {
            if (this.addressData) {
                console.log('Retrying initial population...');
                this.populateAddressFields(this.addressData);
            }
        }, 1000);
    },

    // Set up event listeners
    setupEventListeners() {
        document.addEventListener('DOMContentLoaded', () => {
            console.log('DOM loaded - setting up address field listeners');
            this.setupAddressFields();
        });

        document.addEventListener('profileDataLoaded', (event) => {
            console.log('Profile data loaded event received');
            if (event.detail) {
                this.handleProfileData(event.detail);
            }
        });
    },

    // Set up address fields and their event listeners
    setupAddressFields() {
        // Setup ZIP code input if it exists
        const zipInput = document.getElementById('zipCode');
        if (zipInput && zipInput.tagName === 'INPUT') {
            console.log('Setting up ZIP code input listener');
            zipInput.addEventListener('change', (e) => this.handleZipChange(e));
            zipInput.addEventListener('input', (e) => {
                e.target.value = e.target.value.replace(/[^\d]/g, '').slice(0, 5);
            });
        }
    },

    // Extract address data from various possible formats
    extractAddressData(data) {
        console.log('Extracting address data from:', data);
        
        // More comprehensive ZIP code extraction
        let zip = '';
        if (typeof data.zip === 'string') {
            // Direct string value
            zip = data.zip;
        } else if (data.zip?.value) {
            // Object with value property
            zip = data.zip.value;
        } else if (data.zipCode) {
            // Alternative property name
            zip = data.zipCode;
        } else if (data.zip_code) {
            // Alternative property name with underscore
            zip = data.zip_code;
        }
        
        console.log('Found ZIP code:', zip);
        
        const extracted = {
            zip: zip,
            state: data.state?.value || data.state || '',
            city: data.city?.value || data.city || '',
            address: data.address || ''
        };

        console.log('Extracted address data:', extracted);
        return extracted;
    },

    // Populate address fields with data
    populateAddressFields(data) {
        console.log('Attempting to populate address fields with:', data);

        // Get both input fields and display elements - try all possible IDs
        const fields = {
            zipCode: {
                input: document.querySelector('input#zipCode'),
                display: document.querySelector('p#zip-code, p#zipCode, p#zip_code')
            },
            state: {
                input: document.querySelector('input#state'),
                display: document.querySelector('p#state')
            },
            city: {
                input: document.querySelector('input#city'),
                display: document.querySelector('p#city')
            },
            address: {
                input: document.querySelector('input#address, textarea#address'),
                display: document.querySelector('p#address')
            }
        };

        // Log found elements and their current values
        Object.entries(fields).forEach(([key, elements]) => {
            console.log(`Found elements for ${key}:`, {
                input: elements.input ? {
                    id: elements.input.id,
                    value: elements.input.value,
                    type: elements.input.type
                } : null,
                display: elements.display ? {
                    id: elements.display.id,
                    text: elements.display.textContent
                } : null
            });
        });

        // Helper function to set value based on element type
        const setValue = (elements, value) => {
            if (!value && value !== 0) {
                console.log('No value provided to setValue');
                return;
            }

            const { input, display } = elements;
            
            // Handle input field
            if (input) {
                console.log(`Setting input ${input.id} to:`, value);
                try {
                    // Force value as string
                    const stringValue = String(value);
                    input.value = stringValue;
                    input.setAttribute('value', stringValue);
                    
                    // Create and dispatch events
                    const inputEvent = new Event('input', { bubbles: true });
                    const changeEvent = new Event('change', { bubbles: true });
                    input.dispatchEvent(inputEvent);
                    input.dispatchEvent(changeEvent);
                    
                    console.log(`Input ${input.id} value after setting:`, input.value);
                } catch (error) {
                    console.error(`Error setting input value for ${input.id}:`, error);
                }
            } else {
                console.log('No input element found');
            }

            // Handle display element
            if (display) {
                console.log(`Setting display ${display.id} to:`, value);
                try {
                    // Force value as string
                    display.textContent = String(value);
                    console.log(`Display ${display.id} text after setting:`, display.textContent);
                } catch (error) {
                    console.error(`Error setting display text for ${display.id}:`, error);
                }
            } else {
                console.log('No display element found');
            }
        };

        // Extract and set values
        const addressData = this.extractAddressData(data);
        
        // Set values with verification
        Object.entries(addressData).forEach(([key, value]) => {
            const fieldKey = key === 'zip' ? 'zipCode' : key;
            console.log(`Setting ${fieldKey} with value:`, value);
            setValue(fields[fieldKey], value);
        });

        // Final verification after a delay
        setTimeout(() => {
            const finalValues = {
                zipCode: fields.zipCode.input?.value || fields.zipCode.display?.textContent || '',
                state: fields.state.input?.value || fields.state.display?.textContent || '',
                city: fields.city.input?.value || fields.city.display?.textContent || '',
                address: fields.address.input?.value || fields.address.display?.textContent || ''
            };
            console.log('Final field values:', finalValues);
            
            // If any values are missing, try one more time
            Object.entries(finalValues).forEach(([key, value]) => {
                if ((!value || value === 'N/A') && addressData[key === 'zipCode' ? 'zip' : key]) {
                    console.log(`Final retry for ${key}`);
                    setValue(fields[key], addressData[key === 'zipCode' ? 'zip' : key]);
                }
            });

            // Log the actual DOM values for verification
            console.log('DOM element values:', {
                zipCodeInput: document.querySelector('input#zipCode')?.value,
                zipCodeDisplay: document.querySelector('p#zip-code')?.textContent,
                stateInput: document.querySelector('input#state')?.value,
                stateDisplay: document.querySelector('p#state')?.textContent,
                cityInput: document.querySelector('input#city')?.value,
                cityDisplay: document.querySelector('p#city')?.textContent,
                addressInput: document.querySelector('input#address, textarea#address')?.value,
                addressDisplay: document.querySelector('p#address')?.textContent
            });
        }, 200);
    },

    // Handle ZIP code changes
    handleZipChange(event) {
        const zip = event.target.value;
        console.log('ZIP code changed to:', zip);
        if (zip && zip.length === 5) {
            this.lookupZipCode(zip);
        }
    },

    // Fetch address data from the server
    async fetchAddressData() {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                console.log('No token found for address data');
                return;
            }

            console.log('Fetching address data...');
            const response = await fetch('/api/profile/data', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch address data');
            }

            const data = await response.json();
            console.log('Address data received:', data);
            
            this.addressData = this.extractAddressData(data);
            this.isDataLoaded = true;
            
            // Populate fields immediately
            this.populateAddressFields(this.addressData);
            
            // And dispatch event
            document.dispatchEvent(new CustomEvent('addressDataLoaded', { 
                detail: this.addressData 
            }));

        } catch (error) {
            console.error('Error fetching address data:', error);
        }
    },

    // Look up ZIP code and populate city/state
    async lookupZipCode(zip) {
        try {
            console.log('Looking up ZIP code:', zip);
            
            if (window.zipLookup && typeof window.zipLookup.lookup === 'function') {
                const result = window.zipLookup.lookup(zip);
                if (result) {
                    console.log('Local ZIP lookup result:', result);
                    this.updateAddressFields(result);
                    return;
                }
            }
            
            // If local lookup fails, log it but don't try the API call
            console.log('ZIP code not found in local database:', zip);

        } catch (error) {
            console.error('Error looking up ZIP code:', error);
        }
    },

    // Update address fields with lookup results
    updateAddressFields(data) {
        const addressData = this.extractAddressData(data);
        this.populateAddressFields(addressData);
    },

    // Handle profile data when it's loaded
    handleProfileData(data) {
        console.log('Handling profile data for address fields');
        this.populateAddressFields(data);
    }
};

// Initialize the address handler when the script loads
AddressHandler.init(); 