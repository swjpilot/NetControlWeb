import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { 
  Calendar, 
  ArrowLeft,
  Edit, 
  Trash2, 
  Radio,
  User,
  Clock,
  Users,
  MessageSquare,
  Loader,
  AlertCircle,
  Play,
  Square,
  UserPlus,
  Send,
  Search,
  X,
  MapPin,
  Download
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import axios from 'axios';
import toast from 'react-hot-toast';

const SessionDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('participants');
  const [showAddParticipant, setShowAddParticipant] = useState(false);
  const [showAddTraffic, setShowAddTraffic] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState(null);
  const [qrzLookupData, setQrzLookupData] = useState(null);
  const [callSignInput, setCallSignInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredOperators, setFilteredOperators] = useState([]);
  const [selectedOperator, setSelectedOperator] = useState(null);
  const [showPreCheckIn, setShowPreCheckIn] = useState(false);
  const [preCheckInData, setPreCheckInData] = useState(null);
  const [selectedPreCheckIns, setSelectedPreCheckIns] = useState(new Set());
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualEntryData, setManualEntryData] = useState({
    name: '',
    email: '',
    location: '',
    licenseClass: ''
  });
  const callSignInputRef = useRef(null);
  
  // Traffic form specific states
  const [fromCallSignInput, setFromCallSignInput] = useState('');
  const [toCallSignInput, setToCallSignInput] = useState('');
  const [showFromSuggestions, setShowFromSuggestions] = useState(false);
  const [showToSuggestions, setShowToSuggestions] = useState(false);
  const [filteredFromOperators, setFilteredFromOperators] = useState([]);
  const [filteredToOperators, setFilteredToOperators] = useState([]);
  const [selectedFromOperator, setSelectedFromOperator] = useState(null);
  const [selectedToOperator, setSelectedToOperator] = useState(null);
  const fromCallSignInputRef = useRef(null);
  const toCallSignInputRef = useRef(null);
  const queryClient = useQueryClient();

  const participantForm = useForm();
  const trafficForm = useForm();

  // Fetch session details
  const { data: sessionData, isLoading } = useQuery(
    ['session', id],
    () => axios.get(`/api/sessions/${id}`).then(res => res.data.session),
    {
      enabled: !!id
    }
  );

  // Fetch operators for dropdowns
  const { data: operatorsData } = useQuery(
    'operators-list',
    () => axios.get('/api/operators?limit=1000').then(res => res.data.operators)
  );

  const operators = useMemo(() => operatorsData || [], [operatorsData]);

  // QRZ lookup mutation (defined early to avoid use-before-define issues)
  const qrzLookupMutation = useMutation(
    (callSign) => axios.get(`/api/qrz/lookup/${callSign}`),
    {
      onSuccess: (response) => {
        const data = response.data;
        
        // Map QRZ license class codes to full names
        const mapLicenseClass = (qrzClass) => {
          if (!qrzClass) return '';
          
          const classMap = {
            'E': 'Amateur Extra',
            'A': 'Advanced',
            'G': 'General',
            'T': 'Technician',
            'N': 'Novice',
            'P': 'Technician Plus',
            'Amateur Extra': 'Amateur Extra',
            'Advanced': 'Advanced',
            'General': 'General',
            'Technician': 'Technician',
            'Novice': 'Novice'
          };
          
          return classMap[qrzClass] || qrzClass;
        };
        
        // Store QRZ data for later use when adding as operator
        const mappedData = {
          ...data,
          licenseClass: mapLicenseClass(data.licenseClass)
        };
        
        setQrzLookupData(mappedData);
        
        // Update form field with the call sign from QRZ data
        participantForm.setValue('call_sign', mappedData.callsign);
        
        toast.success(`Found information for ${mappedData.callsign}`);
      },
      onError: (error) => {
        const message = error.response?.data?.error || 'QRZ lookup failed';
        toast.error(message);
        setQrzLookupData(null);
        
        // Show manual entry form if QRZ lookup fails
        setShowManualEntry(true);
        setManualEntryData({
          name: '',
          email: '',
          location: '',
          licenseClass: ''
        });
      }
    }
  );

  // Filter operators based on call sign input
  useEffect(() => {
    if (callSignInput.length >= 2) {
      const filtered = operators.filter(op => 
        op.call_sign.toUpperCase().includes(callSignInput.toUpperCase())
      ).slice(0, 10); // Limit to 10 suggestions
      setFilteredOperators(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setFilteredOperators([]);
      setShowSuggestions(false);
    }
  }, [callSignInput, operators]);

  // Auto QRZ lookup after user stops typing (debounced)
  useEffect(() => {
    if (callSignInput.length >= 3 && !selectedOperator && !qrzLookupData) {
      // Check if this call sign exists in operators database first
      const existingOperator = operators.find(op => 
        op.call_sign.toUpperCase() === callSignInput.toUpperCase()
      );
      
      if (!existingOperator) {
        // Set up debounced QRZ lookup
        const timeoutId = setTimeout(() => {
          console.log('Auto-triggering QRZ lookup for:', callSignInput);
          qrzLookupMutation.mutate(callSignInput.toUpperCase());
        }, 2000); // Wait 2 seconds after user stops typing
        
        return () => clearTimeout(timeoutId);
      }
    }
  }, [callSignInput, operators, selectedOperator, qrzLookupData, qrzLookupMutation]);

  // Filter FROM operators for traffic form
  useEffect(() => {
    if (fromCallSignInput.length >= 2) {
      const filtered = operators.filter(op => 
        op.call_sign.toUpperCase().includes(fromCallSignInput.toUpperCase())
      ).slice(0, 10);
      setFilteredFromOperators(filtered);
      setShowFromSuggestions(filtered.length > 0);
    } else {
      setFilteredFromOperators([]);
      setShowFromSuggestions(false);
    }
  }, [fromCallSignInput, operators]);

  // Filter TO operators for traffic form
  useEffect(() => {
    if (toCallSignInput.length >= 2) {
      const filtered = operators.filter(op => 
        op.call_sign.toUpperCase().includes(toCallSignInput.toUpperCase())
      ).slice(0, 10);
      setFilteredToOperators(filtered);
      setShowToSuggestions(filtered.length > 0);
    } else {
      setFilteredToOperators([]);
      setShowToSuggestions(false);
    }
  }, [toCallSignInput, operators]);

  // Handle clicking outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (callSignInputRef.current && !callSignInputRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
      if (fromCallSignInputRef.current && !fromCallSignInputRef.current.contains(event.target)) {
        setShowFromSuggestions(false);
      }
      if (toCallSignInputRef.current && !toCallSignInputRef.current.contains(event.target)) {
        setShowToSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Add participant mutation
  const addParticipantMutation = useMutation(
    (participantData) => {
      console.log('Sending participant data to API:', participantData);
      return axios.post(`/api/sessions/${id}/participants`, participantData);
    },
    {
      onSuccess: (response) => {
        console.log('Participant added successfully:', response.data);
        queryClient.invalidateQueries(['session', id]);
        queryClient.invalidateQueries('operators-list'); // Refresh operators list too
        toast.success('Participant added successfully');
        
        // Reset form but keep it open for next participant
        participantForm.reset();
        participantForm.setValue('check_in_time', getCurrentTime()); // Set default time for next participant
        setQrzLookupData(null); // Clear QRZ data
        setSelectedOperator(null); // Clear selected operator
        setCallSignInput(''); // Clear input
        
        // Keep the form open - don't set setShowAddParticipant(false)
        // Focus back to the call sign input for quick entry
        setTimeout(() => {
          if (callSignInputRef.current) {
            callSignInputRef.current.focus();
          }
        }, 100);
      },
      onError: (error) => {
        console.error('Failed to add participant:', error);
        toast.error(error.response?.data?.error || 'Failed to add participant');
      }
    }
  );

  // Update participant mutation
  const updateParticipantMutation = useMutation(
    ({ participantId, participantData }) => 
      axios.put(`/api/sessions/${id}/participants/${participantId}`, participantData),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['session', id]);
        toast.success('Participant updated successfully');
        
        // Close form after editing (different from adding)
        setEditingParticipant(null);
        setShowAddParticipant(false);
        setQrzLookupData(null);
        setSelectedOperator(null);
        setCallSignInput('');
        participantForm.reset();
      },
      onError: (error) => {
        toast.error(error.response?.data?.error || 'Failed to update participant');
      }
    }
  );

  // Remove participant mutation
  const removeParticipantMutation = useMutation(
    (participantId) => axios.delete(`/api/sessions/${id}/participants/${participantId}`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['session', id]);
        toast.success('Participant removed successfully');
      },
      onError: (error) => {
        toast.error(error.response?.data?.error || 'Failed to remove participant');
      }
    }
  );

  // Add traffic mutation
  const addTrafficMutation = useMutation(
    (trafficData) => axios.post(`/api/sessions/${id}/traffic`, trafficData),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['session', id]);
        toast.success('Traffic added successfully');
        trafficForm.reset();
        // Clear traffic form state
        setFromCallSignInput('');
        setToCallSignInput('');
        setSelectedFromOperator(null);
        setSelectedToOperator(null);
        setShowFromSuggestions(false);
        setShowToSuggestions(false);
        setShowAddTraffic(false);
      },
      onError: (error) => {
        toast.error(error.response?.data?.error || 'Failed to add traffic');
      }
    }
  );

  // Add operator mutation (for creating operator from QRZ data)
  const addOperatorMutation = useMutation(
    (operatorData) => {
      console.log('Creating operator from QRZ data:', operatorData);
      return axios.post('/api/operators', operatorData);
    },
    {
      onSuccess: (response) => {
        const newOperator = response.data.operator;
        console.log('Operator created successfully:', newOperator);
        
        // Update the operators list immediately
        queryClient.invalidateQueries('operators-list');
        
        // Now add the participant with the new operator ID
        const participantData = {
          operator_id: newOperator.id,
          call_sign: newOperator.call_sign, // Ensure call_sign is included
          check_in_time: participantForm.watch('check_in_time'),
          check_out_time: participantForm.watch('check_out_time'),
          notes: participantForm.watch('notes')
        };
        
        console.log('Adding participant with new operator ID:', participantData);
        
        // Add the participant
        addParticipantMutation.mutate(participantData);
        
        toast.success(`${newOperator.call_sign} added to operators database`);
      },
      onError: (error) => {
        console.error('Failed to create operator:', error);
        const message = error.response?.data?.error || 'Failed to add operator';
        if (message.includes('already exists')) {
          // If operator already exists, try to find them and add as participant
          const callSign = qrzLookupData?.callsign;
          if (callSign) {
            // Refresh operators list first
            queryClient.invalidateQueries('operators-list');
            
            // Wait a moment for the query to refresh, then find the operator
            setTimeout(() => {
              const existingOperator = operators.find(op => 
                op.call_sign.toUpperCase() === callSign.toUpperCase()
              );
              if (existingOperator) {
                console.log('Using existing operator:', existingOperator);
                const participantData = {
                  operator_id: existingOperator.id,
                  call_sign: existingOperator.call_sign,
                  check_in_time: participantForm.watch('check_in_time'),
                  check_out_time: participantForm.watch('check_out_time'),
                  notes: participantForm.watch('notes')
                };
                addParticipantMutation.mutate(participantData);
                toast.success(`Using existing operator record for ${callSign}`);
              } else {
                // Fallback to call sign only
                console.log('Fallback to call sign only');
                const participantData = {
                  call_sign: callSign,
                  check_in_time: participantForm.watch('check_in_time'),
                  check_out_time: participantForm.watch('check_out_time'),
                  notes: participantForm.watch('notes')
                };
                addParticipantMutation.mutate(participantData);
              }
            }, 500);
          }
        } else {
          toast.error(message);
        }
      }
    }
  );

  // Fetch pre-check-in data mutation
  const fetchPreCheckInMutation = useMutation(
    () => axios.get('/api/pre-checkin'),
    {
      onSuccess: async (response) => {
        const preCheckInParticipants = response.data.participants;
        
        // Check which participants are already in the operators database
        const enrichedParticipants = await Promise.all(
          preCheckInParticipants.map(async (participant) => {
            try {
              // Check if operator exists in database
              const existingOperator = operators.find(op => 
                op.call_sign.toUpperCase() === participant.callSign.toUpperCase()
              );
              
              return {
                ...participant,
                hasOperatorRecord: !!existingOperator,
                operatorInfo: existingOperator
              };
            } catch (error) {
              return {
                ...participant,
                hasOperatorRecord: false
              };
            }
          })
        );
        
        setPreCheckInData({
          ...response.data,
          participants: enrichedParticipants
        });
        setShowPreCheckIn(true);
        
        const needsQRZ = enrichedParticipants.filter(p => !p.hasOperatorRecord).length;
        const hasOperators = enrichedParticipants.filter(p => p.hasOperatorRecord).length;
        
        let message = `Found ${response.data.participants.length} pre-checked-in participants`;
        if (needsQRZ > 0) {
          message += ` (${needsQRZ} will get QRZ lookup)`;
        }
        
        toast.success(message);
      },
      onError: (error) => {
        console.error('Failed to fetch pre-check-in data:', error);
        toast.error(error.response?.data?.error || 'Failed to fetch pre-check-in data');
      }
    }
  );

  // Add multiple participants from pre-check-in with QRZ lookup
  const addMultipleParticipantsMutation = useMutation(
    (selectedParticipants) => {
      return axios.post('/api/pre-checkin/process', {
        participants: selectedParticipants,
        sessionId: id
      });
    },
    {
      onSuccess: (response) => {
        queryClient.invalidateQueries(['session', id]);
        queryClient.invalidateQueries('operators-list');
        
        const { processed, errors, results } = response.data;
        
        if (processed > 0) {
          const operatorsCreated = results.filter(r => r.operatorCreated).length;
          const qrzLookups = results.filter(r => r.hasQRZData).length;
          
          let message = `Added ${processed} participants successfully`;
          if (operatorsCreated > 0) {
            message += ` (${operatorsCreated} new operators created`;
            if (qrzLookups > 0) {
              message += ` with QRZ data`;
            }
            message += `)`;
          }
          
          toast.success(message);
        }
        
        if (errors.length > 0) {
          errors.forEach(error => {
            toast.error(`${error.callSign}: ${error.error}`);
          });
        }
        
        setShowPreCheckIn(false);
        setSelectedPreCheckIns(new Set());
      },
      onError: (error) => {
        console.error('Failed to process pre-check-in participants:', error);
        toast.error(error.response?.data?.error || 'Failed to process participants');
      }
    }
  );

  // Add single participant from pre-check-in with QRZ lookup
  const addSinglePreCheckInMutation = useMutation(
    (participant) => {
      return axios.post('/api/pre-checkin/process', {
        participants: [participant],
        sessionId: id
      });
    },
    {
      onSuccess: (response) => {
        queryClient.invalidateQueries(['session', id]);
        queryClient.invalidateQueries('operators-list');
        
        const { results, errors } = response.data;
        
        if (results.length > 0) {
          const result = results[0];
          let message = `${result.callSign} added successfully`;
          
          if (result.operatorCreated) {
            message += result.hasQRZData ? ' (new operator created with QRZ data)' : ' (new operator created)';
          }
          
          toast.success(message);
        }
        
        if (errors.length > 0) {
          toast.error(`${errors[0].callSign}: ${errors[0].error}`);
        }
      },
      onError: (error) => {
        console.error('Failed to add pre-check-in participant:', error);
        toast.error(error.response?.data?.error || 'Failed to add participant');
      }
    }
  );

  const onSubmitParticipant = (data) => {
    console.log('Submitting participant data:', data);
    console.log('Selected operator:', selectedOperator);
    console.log('QRZ lookup data:', qrzLookupData);
    console.log('Call sign input:', callSignInput);
    console.log('Form data call_sign:', data.call_sign);
    
    // Use selected operator call sign, form data call sign, or call sign input
    const finalCallSign = selectedOperator?.call_sign || data.call_sign || callSignInput.trim();
    const finalOperatorId = selectedOperator?.id || data.operator_id;
    
    // Validate that we have a call sign
    if (!finalCallSign) {
      toast.error('Please enter a call sign');
      return;
    }
    
    // If we have QRZ data and no selected operator, create the operator first
    if (!selectedOperator && qrzLookupData && qrzLookupData.callsign && qrzLookupData.callsign.toUpperCase() === finalCallSign.toUpperCase()) {
      console.log('Creating operator from QRZ data first');
      const operatorData = {
        call_sign: qrzLookupData.callsign,
        name: qrzLookupData.name || '',
        address: qrzLookupData.address || '',
        city: qrzLookupData.city || '',
        state: qrzLookupData.state || '',
        email: qrzLookupData.email || '',
        license_class: qrzLookupData.licenseClass || '',
        notes: `Added from QRZ lookup during session check-in on ${new Date().toLocaleDateString()}. Grid: ${qrzLookupData.grid || 'N/A'}`
      };
      
      // Add operator first, then the mutation will handle adding the participant
      addOperatorMutation.mutate(operatorData);
      return;
    }
    
    // Prepare participant data
    const participantData = {
      ...data,
      operator_id: finalOperatorId || null,
      call_sign: finalCallSign
    };
    
    console.log('Adding participant directly:', participantData);
    if (editingParticipant) {
      updateParticipantMutation.mutate({
        participantId: editingParticipant.id,
        participantData
      });
    } else {
      addParticipantMutation.mutate(participantData);
    }
  };

  const onSubmitTraffic = (data) => {
    addTrafficMutation.mutate(data);
  };

  const handleEditParticipant = (participant) => {
    setEditingParticipant(participant);
    
    // Set up the autocomplete state
    if (participant.operator_id) {
      const operator = operators.find(op => op.id === participant.operator_id);
      if (operator) {
        setSelectedOperator(operator);
        setCallSignInput(operator.call_sign);
      }
    } else {
      setSelectedOperator(null);
      setCallSignInput(participant.call_sign || '');
    }
    
    // Set form values
    participantForm.setValue('operator_id', participant.operator_id || '');
    participantForm.setValue('call_sign', participant.call_sign || '');
    participantForm.setValue('check_in_time', participant.check_in_time || '');
    participantForm.setValue('check_out_time', participant.check_out_time || '');
    participantForm.setValue('notes', participant.notes || '');
    setShowAddParticipant(true);
  };

  const handleRemoveParticipant = (participant) => {
    if (window.confirm(`Remove ${participant.call_sign || participant.operator_call} from this session?`)) {
      removeParticipantMutation.mutate(participant.id);
    }
  };

  const cancelParticipantEdit = () => {
    if (editingParticipant) {
      // If editing, close the form completely
      setEditingParticipant(null);
      setShowAddParticipant(false);
    } else {
      // If adding new, just reset but keep form open
      participantForm.reset();
      participantForm.setValue('check_in_time', getCurrentTime());
    }
    
    setQrzLookupData(null);
    setSelectedOperator(null);
    setCallSignInput('');
    setShowManualEntry(false);
    setManualEntryData({
      name: '',
      email: '',
      location: '',
      licenseClass: ''
    });
    
    // Focus back to input if form is still open
    if (!editingParticipant) {
      setTimeout(() => {
        if (callSignInputRef.current) {
          callSignInputRef.current.focus();
        }
      }, 100);
    }
  };

  const handleQRZLookup = () => {
    const callSign = callSignInput.trim();
    if (callSign) {
      qrzLookupMutation.mutate(callSign.toUpperCase());
    } else {
      toast.error('Please enter a callsign first');
    }
  };

  const handleCallSignInputChange = (e) => {
    const value = e.target.value.toUpperCase();
    setCallSignInput(value);
    setSelectedOperator(null);
    setQrzLookupData(null);
    
    // Update form value
    participantForm.setValue('call_sign', value);
    participantForm.setValue('operator_id', '');
  };

  const handleCallSignKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      
      const callSign = callSignInput.trim();
      if (!callSign) {
        toast.error('Please enter a call sign');
        return;
      }
      
      // Check if this call sign exists in operators database
      const existingOperator = operators.find(op => 
        op.call_sign.toUpperCase() === callSign.toUpperCase()
      );
      
      if (existingOperator) {
        // If operator exists, select them and add as participant
        handleOperatorSelect(existingOperator);
        toast.success(`Found existing operator: ${existingOperator.call_sign}`);
        
        // Auto-submit the form after a short delay to allow state updates
        setTimeout(() => {
          const formData = {
            operator_id: existingOperator.id,
            call_sign: existingOperator.call_sign,
            check_in_time: participantForm.getValues('check_in_time') || getCurrentTime(),
            check_out_time: participantForm.getValues('check_out_time') || '',
            notes: participantForm.getValues('notes') || ''
          };
          onSubmitParticipant(formData);
        }, 100);
      } else if (qrzLookupData && qrzLookupData.callsign && qrzLookupData.callsign.toUpperCase() === callSign.toUpperCase()) {
        // If we already have QRZ data for this call sign, add as participant
        console.log('Adding participant with existing QRZ data');
        const participantData = {
          operator_id: null,
          call_sign: callSign,
          check_in_time: participantForm.getValues('check_in_time') || getCurrentTime(),
          check_out_time: participantForm.getValues('check_out_time') || '',
          notes: participantForm.getValues('notes') || ''
        };
        
        // Create operator from QRZ data first
        const operatorData = {
          call_sign: qrzLookupData.callsign,
          name: qrzLookupData.name || '',
          address: qrzLookupData.address || '',
          city: qrzLookupData.city || '',
          state: qrzLookupData.state || '',
          email: qrzLookupData.email || '',
          license_class: qrzLookupData.licenseClass || '',
          notes: `Added from QRZ lookup during session check-in on ${new Date().toLocaleDateString()}. Grid: ${qrzLookupData.grid || 'N/A'}`
        };
        
        // Create operator first, then add as participant
        axios.post('/api/operators', operatorData)
          .then((response) => {
            const newOperator = response.data.operator;
            console.log('Operator created from QRZ data:', newOperator);
            
            // Update the operators list
            queryClient.invalidateQueries('operators-list');
            
            // Add the participant with the new operator ID
            const updatedParticipantData = {
              ...participantData,
              operator_id: newOperator.id,
              call_sign: newOperator.call_sign
            };
            
            addParticipantMutation.mutate(updatedParticipantData);
            toast.success(`${newOperator.call_sign} added from QRZ data`);
          })
          .catch((error) => {
            console.error('Failed to create operator from QRZ:', error);
            const message = error.response?.data?.error || 'Failed to add operator';
            
            if (message.includes('already exists')) {
              // If operator already exists, find them and add as participant
              queryClient.invalidateQueries('operators-list');
              
              setTimeout(() => {
                const existingOperator = operators.find(op => 
                  op.call_sign.toUpperCase() === callSign.toUpperCase()
                );
                if (existingOperator) {
                  const updatedParticipantData = {
                    ...participantData,
                    operator_id: existingOperator.id,
                    call_sign: existingOperator.call_sign
                  };
                  addParticipantMutation.mutate(updatedParticipantData);
                  toast.success(`Using existing operator record for ${callSign}`);
                } else {
                  // Fallback to call sign only
                  addParticipantMutation.mutate(participantData);
                  toast.success(`Added ${callSign} (call sign only)`);
                }
              }, 500);
            } else {
              // Fallback to call sign only
              addParticipantMutation.mutate(participantData);
              toast.success(`Added ${callSign} (call sign only)`);
            }
          });
      } else {
        // If not found and no QRZ data, perform QRZ lookup
        // If QRZ lookup fails, it will show the manual entry form
        handleQRZLookup();
      }
    }
  };

  const handleOperatorSelect = (operator) => {
    setSelectedOperator(operator);
    setCallSignInput(operator.call_sign);
    setShowSuggestions(false);
    setQrzLookupData(null);
    
    // Update form values
    participantForm.setValue('operator_id', operator.id);
    participantForm.setValue('call_sign', operator.call_sign);
  };

  const clearSelection = () => {
    setSelectedOperator(null);
    setCallSignInput('');
    setQrzLookupData(null);
    participantForm.setValue('operator_id', '');
    participantForm.setValue('call_sign', '');
  };

  // Traffic form handlers
  const handleFromCallSignInputChange = (e) => {
    const value = e.target.value.toUpperCase();
    setFromCallSignInput(value);
    setSelectedFromOperator(null);
    trafficForm.setValue('from_call', value);
    trafficForm.setValue('from_operator_id', '');
  };

  const handleToCallSignInputChange = (e) => {
    const value = e.target.value.toUpperCase();
    setToCallSignInput(value);
    setSelectedToOperator(null);
    trafficForm.setValue('to_call', value);
    trafficForm.setValue('to_operator_id', '');
  };

  const handleFromOperatorSelect = (operator) => {
    setSelectedFromOperator(operator);
    setFromCallSignInput(operator.call_sign);
    setShowFromSuggestions(false);
    trafficForm.setValue('from_operator_id', operator.id);
    trafficForm.setValue('from_call', operator.call_sign);
  };

  const handleToOperatorSelect = (operator) => {
    setSelectedToOperator(operator);
    setToCallSignInput(operator.call_sign);
    setShowToSuggestions(false);
    trafficForm.setValue('to_operator_id', operator.id);
    trafficForm.setValue('to_call', operator.call_sign);
  };

  const clearFromSelection = () => {
    setSelectedFromOperator(null);
    setFromCallSignInput('');
    trafficForm.setValue('from_operator_id', '');
    trafficForm.setValue('from_call', '');
  };

  const clearToSelection = () => {
    setSelectedToOperator(null);
    setToCallSignInput('');
    trafficForm.setValue('to_operator_id', '');
    trafficForm.setValue('to_call', '');
  };

  const handleFetchPreCheckIn = () => {
    fetchPreCheckInMutation.mutate();
  };

  const handlePreCheckInSelect = (participant, isSelected) => {
    const newSelected = new Set(selectedPreCheckIns);
    if (isSelected) {
      newSelected.add(participant.callSign);
    } else {
      newSelected.delete(participant.callSign);
    }
    setSelectedPreCheckIns(newSelected);
  };

  const handleSelectAllPreCheckIn = () => {
    if (selectedPreCheckIns.size === preCheckInData?.participants.length) {
      setSelectedPreCheckIns(new Set());
    } else {
      setSelectedPreCheckIns(new Set(preCheckInData?.participants.map(p => p.callSign)));
    }
  };

  const handleAddSelectedPreCheckIn = () => {
    if (selectedPreCheckIns.size === 0) {
      toast.error('Please select participants to add');
      return;
    }

    const selectedParticipants = preCheckInData.participants.filter(p => 
      selectedPreCheckIns.has(p.callSign)
    );

    addMultipleParticipantsMutation.mutate(selectedParticipants);
  };

  const handleAddSinglePreCheckIn = (participant) => {
    addSinglePreCheckInMutation.mutate(participant);
  };

  const handleManualEntryChange = (field, value) => {
    setManualEntryData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleManualEntrySubmit = () => {
    const callSign = callSignInput.trim();
    if (!callSign) {
      toast.error('Please enter a call sign');
      return;
    }

    // Create operator data from manual entry
    const operatorData = {
      callSign: callSign,
      name: manualEntryData.name || '',
      email: manualEntryData.email || '',
      location: manualEntryData.location || '',
      class: manualEntryData.licenseClass || '',
      comment: `Added manually during session check-in on ${new Date().toLocaleDateString()}`
    };

    // Create operator first, then add as participant
    console.log('Creating operator from manual entry:', operatorData);
    
    // Call the operator creation API directly
    axios.post('/api/operators', operatorData)
      .then((response) => {
        const newOperator = response.data.operator;
        console.log('Operator created successfully:', newOperator);
        
        // Update the operators list
        queryClient.invalidateQueries('operators-list');
        
        // Add the participant with the new operator ID
        const participantData = {
          operator_id: newOperator.id,
          call_sign: newOperator.call_sign,
          check_in_time: participantForm.getValues('check_in_time') || getCurrentTime(),
          check_out_time: participantForm.getValues('check_out_time') || '',
          notes: participantForm.getValues('notes') || ''
        };
        
        console.log('Adding participant with new operator ID:', participantData);
        addParticipantMutation.mutate(participantData);
        
        toast.success(`${newOperator.call_sign} added to operators database`);
        setShowManualEntry(false);
      })
      .catch((error) => {
        console.error('Failed to create operator:', error);
        const message = error.response?.data?.error || 'Failed to add operator';
        
        if (message.includes('already exists')) {
          // If operator already exists, try to find them and add as participant
          queryClient.invalidateQueries('operators-list');
          
          setTimeout(() => {
            const existingOperator = operators.find(op => 
              op.call_sign.toUpperCase() === callSign.toUpperCase()
            );
            if (existingOperator) {
              const participantData = {
                operator_id: existingOperator.id,
                call_sign: existingOperator.call_sign,
                check_in_time: participantForm.getValues('check_in_time') || getCurrentTime(),
                check_out_time: participantForm.getValues('check_out_time') || '',
                notes: participantForm.getValues('notes') || ''
              };
              addParticipantMutation.mutate(participantData);
              toast.success(`Using existing operator record for ${callSign}`);
              setShowManualEntry(false);
            }
          }, 500);
        } else {
          toast.error(message);
        }
      });
  };

  const handleManualEntryCancel = () => {
    setShowManualEntry(false);
    setManualEntryData({
      name: '',
      email: '',
      location: '',
      licenseClass: ''
    });
  };

  const handleManualEntrySkip = () => {
    const callSign = callSignInput.trim();
    if (!callSign) {
      toast.error('Please enter a call sign');
      return;
    }

    // Add participant without creating operator record
    const participantData = {
      operator_id: null,
      call_sign: callSign,
      check_in_time: participantForm.getValues('check_in_time') || getCurrentTime(),
      check_out_time: participantForm.getValues('check_out_time') || '',
      notes: participantForm.getValues('notes') || ''
    };
    
    console.log('Adding participant without operator record:', participantData);
    addParticipantMutation.mutate(participantData);
    setShowManualEntry(false);
  };

  const getCurrentTime = () => {
    return new Date().toTimeString().slice(0, 5);
  };

  const messageTypes = ['Routine', 'Priority', 'Welfare', 'Emergency'];
  const precedences = ['Routine', 'Welfare', 'Priority', 'Emergency'];

  if (isLoading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Loading session details...</p>
      </div>
    );
  }

  if (!sessionData) {
    return (
      <div className="text-center py-4">
        <AlertCircle size={48} className="text-muted mb-3" />
        <h3>Session Not Found</h3>
        <p className="text-muted">The requested session could not be found.</p>
        <button className="btn btn-primary" onClick={() => navigate('/sessions')}>
          <ArrowLeft size={16} className="me-2" />
          Back to Sessions
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div className="d-flex align-items-center">
          <button 
            className="btn btn-outline-secondary me-3"
            onClick={() => navigate('/sessions')}
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1>
              <Calendar size={24} className="me-2" />
              Session: {(() => {
                const sessionDate = new Date(sessionData.session_date);
                const localDate = new Date(sessionDate.getTime() + sessionDate.getTimezoneOffset() * 60000);
                return localDate.toLocaleDateString();
              })()}
            </h1>
            <p className="text-muted mb-0">
              Net Control: {sessionData.net_control_call}
              {sessionData.net_control_name && ` (${sessionData.net_control_name})`}
            </p>
          </div>
        </div>
      </div>

      {/* Session Info Card */}
      <div className="card mb-4">
        <div className="card-header">
          <h2 className="card-title">Session Information</h2>
        </div>
        <div className="card-body">
          <div className="row">
            <div className="col-md-6">
              <div className="info-group">
                <div className="info-item">
                  <Calendar size={16} className="text-muted me-2" />
                  <strong>Date:</strong>
                  <span className="ms-2">{(() => {
                    const sessionDate = new Date(sessionData.session_date);
                    const localDate = new Date(sessionDate.getTime() + sessionDate.getTimezoneOffset() * 60000);
                    return localDate.toLocaleDateString();
                  })()}</span>
                </div>
                
                <div className="info-item">
                  <Radio size={16} className="text-muted me-2" />
                  <strong>Net Control:</strong>
                  <span className="ms-2">
                    {sessionData.net_control_call}
                    {sessionData.net_control_name && ` (${sessionData.net_control_name})`}
                  </span>
                </div>

                {sessionData.frequency && (
                  <div className="info-item">
                    <strong>Frequency:</strong>
                    <span className="ms-2">{sessionData.frequency}</span>
                    {sessionData.mode && sessionData.mode !== 'FM' && (
                      <span className="badge bg-info ms-2">{sessionData.mode}</span>
                    )}
                  </div>
                )}

                {(sessionData.start_time || sessionData.end_time) && (
                  <div className="info-item">
                    <Clock size={16} className="text-muted me-2" />
                    <strong>Time:</strong>
                    <span className="ms-2">
                      {sessionData.start_time && (
                        <span className="text-success">
                          <Play size={12} className="me-1" />
                          {sessionData.start_time}
                        </span>
                      )}
                      {sessionData.start_time && sessionData.end_time && ' - '}
                      {sessionData.end_time && (
                        <span className="text-danger">
                          <Square size={12} className="me-1" />
                          {sessionData.end_time}
                        </span>
                      )}
                    </span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="col-md-6">
              <div className="info-group">
                <div className="info-item">
                  <strong>Type:</strong>
                  <span className="badge bg-info ms-2">{sessionData.net_type || 'Regular'}</span>
                </div>

                {sessionData.power && (
                  <div className="info-item">
                    <strong>Power:</strong>
                    <span className="ms-2">{sessionData.power}</span>
                  </div>
                )}

                {sessionData.antenna && (
                  <div className="info-item">
                    <strong>Antenna:</strong>
                    <span className="ms-2">{sessionData.antenna}</span>
                  </div>
                )}

                {sessionData.weather && (
                  <div className="info-item">
                    <strong>Weather:</strong>
                    <span className="ms-2">{sessionData.weather}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {sessionData.notes && (
            <div className="mt-3">
              <strong>Notes:</strong>
              <div className="mt-2 p-2 bg-light rounded">
                {sessionData.notes}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="card">
        <div className="card-header">
          <ul className="nav nav-pills">
            <li className="nav-item">
              <button 
                className={`nav-link ${activeTab === 'participants' ? 'active' : ''}`}
                onClick={() => setActiveTab('participants')}
              >
                <Users size={16} className="me-2" />
                Participants ({sessionData.participants?.length || 0})
              </button>
            </li>
            <li className="nav-item">
              <button 
                className={`nav-link ${activeTab === 'traffic' ? 'active' : ''}`}
                onClick={() => setActiveTab('traffic')}
              >
                <MessageSquare size={16} className="me-2" />
                Traffic ({sessionData.traffic?.length || 0})
              </button>
            </li>
          </ul>
        </div>

        <div className="card-body">
          {/* Participants Tab */}
          {activeTab === 'participants' && (
            <div>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h3>Session Participants</h3>
                <div className="d-flex gap-2">
                  <button 
                    className="btn btn-outline-info"
                    onClick={handleFetchPreCheckIn}
                    disabled={fetchPreCheckInMutation.isLoading}
                  >
                    {fetchPreCheckInMutation.isLoading ? (
                      <>
                        <Loader size={16} className="animate-spin me-2" />
                        Loading...
                      </>
                    ) : (
                      <>
                        <Download size={16} className="me-2" />
                        Pre-Check-In List
                      </>
                    )}
                  </button>
                  <button 
                    className="btn btn-primary"
                    onClick={() => {
                      setShowAddParticipant(true);
                      // Initialize form with default values
                      participantForm.setValue('check_in_time', getCurrentTime());
                      participantForm.setValue('check_out_time', '');
                      participantForm.setValue('notes', '');
                      participantForm.setValue('call_sign', '');
                      participantForm.setValue('operator_id', '');
                      // Focus on the call sign input after a short delay
                      setTimeout(() => {
                        if (callSignInputRef.current) {
                          callSignInputRef.current.focus();
                        }
                      }, 100);
                    }}
                  >
                    <UserPlus size={16} className="me-2" />
                    Add Participant
                  </button>
                </div>
              </div>

              {/* Add/Edit Participant Form */}
              {showAddParticipant && (
                <div className="card mb-4">
                  <div className="card-header">
                    <h4>{editingParticipant ? 'Edit Participant' : 'Add Participant'}</h4>
                  </div>
                  <div className="card-body">
                    <form onSubmit={participantForm.handleSubmit(onSubmitParticipant)}>
                      <div className="form-group">
                        <label className="form-label">Call Sign / Operator Search</label>
                        <div className="autocomplete-container" ref={callSignInputRef}>
                          <div className="input-group">
                            <input
                              type="text"
                              className="form-control"
                              placeholder="Type call sign to search operators or enter new..."
                              value={callSignInput}
                              onChange={handleCallSignInputChange}
                              onKeyDown={handleCallSignKeyDown}
                              onFocus={() => {
                                if (filteredOperators.length > 0) {
                                  setShowSuggestions(true);
                                }
                              }}
                              style={{ textTransform: 'uppercase' }}
                            />
                            {(selectedOperator || callSignInput) && (
                              <button 
                                type="button"
                                className="btn btn-outline-secondary"
                                onClick={clearSelection}
                                title="Clear selection"
                              >
                                <X size={16} />
                              </button>
                            )}
                            <button 
                              type="button"
                              className="btn btn-outline-secondary"
                              onClick={handleQRZLookup}
                              disabled={qrzLookupMutation.isLoading || !callSignInput.trim()}
                              title="Lookup callsign information from QRZ"
                            >
                              {qrzLookupMutation.isLoading ? (
                                <Loader size={16} className="animate-spin" />
                              ) : (
                                <Search size={16} />
                              )}
                            </button>
                          </div>
                          
                          {/* Autocomplete Suggestions */}
                          {showSuggestions && filteredOperators.length > 0 && (
                            <div className="autocomplete-suggestions">
                              {filteredOperators.map(operator => (
                                <div
                                  key={operator.id}
                                  className="autocomplete-suggestion"
                                  onClick={() => handleOperatorSelect(operator)}
                                >
                                  <div className="d-flex align-items-center">
                                    <Radio size={14} className="text-primary me-2" />
                                    <div>
                                      <strong>{operator.call_sign}</strong>
                                      {operator.name && (
                                        <span className="text-muted ms-2">- {operator.name}</span>
                                      )}
                                      {operator.location && (
                                        <div className="small text-muted">{operator.location}</div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          
                          {/* Selected Operator Display */}
                          {selectedOperator && (
                            <div className="selected-operator mt-2">
                              <div className="alert alert-success mb-0">
                                <div className="d-flex align-items-center">
                                  <User size={16} className="me-2" />
                                  <div>
                                    <strong>{selectedOperator.call_sign}</strong>
                                    {selectedOperator.name && (
                                      <span className="ms-2">- {selectedOperator.name}</span>
                                    )}
                                    {selectedOperator.location && (
                                      <div className="small">{selectedOperator.location}</div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                          
                          {/* QRZ Data Found Indicator */}
                          {qrzLookupData && !selectedOperator && (
                            <div className="qrz-data-found mt-2">
                              <div className="alert alert-info mb-0">
                                <div className="d-flex align-items-center">
                                  <Search size={16} className="me-2" />
                                  <div>
                                    <strong>QRZ Data Found: {qrzLookupData.callsign}</strong>
                                    {qrzLookupData.name && (
                                      <span className="ms-2">- {qrzLookupData.name}</span>
                                    )}
                                    <div className="small">
                                      {qrzLookupData.city && qrzLookupData.state && `${qrzLookupData.city}, ${qrzLookupData.state}`}
                                      {qrzLookupData.licenseClass && ` • ${qrzLookupData.licenseClass} Class`}
                                    </div>
                                    <div className="small text-muted">
                                      Will be added to operators database when you submit
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                          
                          <div className="form-text">
                            {qrzLookupMutation.isLoading ? (
                              <div className="text-info">
                                <Loader size={12} className="animate-spin me-1" />
                                Looking up {callSignInput} in QRZ database...
                              </div>
                            ) : callSignInput.length >= 2 && filteredOperators.length === 0 && !selectedOperator && !qrzLookupData ? (
                              <div className="text-muted">
                                No existing operators found. {callSignInput.length >= 3 ? 'Auto-lookup from QRZ in progress...' : 'Type more characters for auto QRZ lookup.'}
                              </div>
                            ) : (
                              'Type 2+ characters to search existing operators. QRZ lookup happens automatically after 3+ characters.'
                            )}
                          </div>
                        </div>
                        
                        {/* Hidden form fields for react-hook-form */}
                        <input type="hidden" {...participantForm.register('operator_id')} />
                        <input type="hidden" {...participantForm.register('call_sign')} />
                      </div>

                      {/* QRZ Lookup Results */}
                      {qrzLookupData && (
                        <div className="alert alert-info mb-3">
                          <div className="d-flex justify-content-between align-items-start">
                            <div>
                              <h6 className="mb-2">
                                <Radio size={16} className="me-2" />
                                QRZ Information for {qrzLookupData.callsign}
                              </h6>
                              <div className="row">
                                <div className="col-md-6">
                                  {qrzLookupData.name && (
                                    <div className="small mb-1">
                                      <strong>Name:</strong> {qrzLookupData.name}
                                    </div>
                                  )}
                                  {qrzLookupData.licenseClass && (
                                    <div className="small mb-1">
                                      <strong>License:</strong> {qrzLookupData.licenseClass}
                                    </div>
                                  )}
                                  {qrzLookupData.grid && (
                                    <div className="small mb-1">
                                      <strong>Grid:</strong> {qrzLookupData.grid}
                                    </div>
                                  )}
                                </div>
                                <div className="col-md-6">
                                  {qrzLookupData.city && qrzLookupData.state && (
                                    <div className="small mb-1">
                                      <strong>Location:</strong> {qrzLookupData.city}, {qrzLookupData.state}
                                    </div>
                                  )}
                                  {qrzLookupData.email && (
                                    <div className="small mb-1">
                                      <strong>Email:</strong> {qrzLookupData.email}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="small text-muted mt-2">
                                ℹ️ This operator will be automatically added to your operators database when they check in.
                              </div>
                            </div>
                            <button 
                              type="button"
                              className="btn btn-sm btn-outline-secondary"
                              onClick={() => setQrzLookupData(null)}
                              title="Clear QRZ data"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Manual Entry Form */}
                      {showManualEntry && (
                        <div className="alert alert-warning mb-3">
                          <div className="d-flex justify-content-between align-items-start">
                            <div className="flex-grow-1">
                              <h6 className="mb-2">
                                <User size={16} className="me-2" />
                                Manual Entry for {callSignInput}
                              </h6>
                              <div className="small text-muted mb-3">
                                QRZ lookup failed. You can enter operator information manually or skip to add just the call sign.
                              </div>
                              
                              <div className="row">
                                <div className="col-md-6">
                                  <div className="form-group mb-2">
                                    <label className="form-label small">Name</label>
                                    <input
                                      type="text"
                                      className="form-control form-control-sm"
                                      placeholder="Operator name"
                                      value={manualEntryData.name}
                                      onChange={(e) => handleManualEntryChange('name', e.target.value)}
                                    />
                                  </div>
                                  <div className="form-group mb-2">
                                    <label className="form-label small">License Class</label>
                                    <select
                                      className="form-control form-control-sm"
                                      value={manualEntryData.licenseClass}
                                      onChange={(e) => handleManualEntryChange('licenseClass', e.target.value)}
                                    >
                                      <option value="">Select class</option>
                                      <option value="Amateur Extra">Amateur Extra</option>
                                      <option value="Advanced">Advanced</option>
                                      <option value="General">General</option>
                                      <option value="Technician">Technician</option>
                                      <option value="Novice">Novice</option>
                                    </select>
                                  </div>
                                </div>
                                <div className="col-md-6">
                                  <div className="form-group mb-2">
                                    <label className="form-label small">Email</label>
                                    <input
                                      type="email"
                                      className="form-control form-control-sm"
                                      placeholder="email@example.com"
                                      value={manualEntryData.email}
                                      onChange={(e) => handleManualEntryChange('email', e.target.value)}
                                    />
                                  </div>
                                  <div className="form-group mb-2">
                                    <label className="form-label small">Location</label>
                                    <input
                                      type="text"
                                      className="form-control form-control-sm"
                                      placeholder="City, State"
                                      value={manualEntryData.location}
                                      onChange={(e) => handleManualEntryChange('location', e.target.value)}
                                    />
                                  </div>
                                </div>
                              </div>
                              
                              <div className="d-flex gap-2 mt-3">
                                <button 
                                  type="button"
                                  className="btn btn-sm btn-success"
                                  onClick={handleManualEntrySubmit}
                                >
                                  <User size={14} className="me-1" />
                                  Create & Add
                                </button>
                                <button 
                                  type="button"
                                  className="btn btn-sm btn-outline-primary"
                                  onClick={handleManualEntrySkip}
                                >
                                  Skip & Add Call Sign Only
                                </button>
                                <button 
                                  type="button"
                                  className="btn btn-sm btn-outline-secondary"
                                  onClick={handleManualEntryCancel}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="form-row">
                        <div className="form-group">
                          <label className="form-label">Check-in Time</label>
                          <input
                            type="time"
                            className="form-control"
                            defaultValue={getCurrentTime()}
                            {...participantForm.register('check_in_time')}
                          />
                        </div>
                        
                        <div className="form-group">
                          <label className="form-label">Check-out Time</label>
                          <input
                            type="time"
                            className="form-control"
                            {...participantForm.register('check_out_time')}
                          />
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Notes</label>
                        <textarea
                          className="form-control"
                          rows="2"
                          placeholder="Additional notes about this participant..."
                          {...participantForm.register('notes')}
                        />
                      </div>

                      <div className="d-flex gap-2">
                        <button 
                          type="submit" 
                          className="btn btn-primary"
                          disabled={addParticipantMutation.isLoading || updateParticipantMutation.isLoading}
                        >
                          {(addParticipantMutation.isLoading || updateParticipantMutation.isLoading) ? (
                            <>
                              <Loader size={16} className="animate-spin" />
                              {editingParticipant ? 'Updating...' : 'Adding...'}
                            </>
                          ) : (
                            <>
                              {editingParticipant ? 'Update Participant' : 'Add Participant'}
                            </>
                          )}
                        </button>
                        <button 
                          type="button" 
                          className="btn btn-secondary"
                          onClick={cancelParticipantEdit}
                        >
                          {editingParticipant ? 'Cancel Edit' : 'Reset Form'}
                        </button>
                        {!editingParticipant && (
                          <button 
                            type="button" 
                            className="btn btn-outline-secondary"
                            onClick={() => {
                              setShowAddParticipant(false);
                              setQrzLookupData(null);
                              setSelectedOperator(null);
                              setCallSignInput('');
                              setShowManualEntry(false);
                              setManualEntryData({
                                name: '',
                                email: '',
                                location: '',
                                licenseClass: ''
                              });
                              participantForm.reset();
                            }}
                          >
                            Close Form
                          </button>
                        )}
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Participants List */}
              {sessionData.participants && sessionData.participants.length > 0 ? (
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Call Sign</th>
                        <th>Operator</th>
                        <th>Location</th>
                        <th>Check-in</th>
                        <th>Check-out</th>
                        <th>Notes</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessionData.participants.map((participant) => (
                        <tr 
                          key={participant.id}
                          style={{ cursor: 'pointer' }}
                          onClick={(e) => {
                            // Don't trigger edit if clicking on action buttons
                            if (e.target.closest('.btn')) return;
                            handleEditParticipant(participant);
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = ''}
                        >
                          <td>
                            <div className="d-flex align-items-center">
                              <Radio size={16} className="text-primary me-2" />
                              <strong>
                                {participant.display_call_sign || participant.call_sign || participant.operator_call}
                              </strong>
                            </div>
                          </td>
                          <td>
                            {(participant.display_name || participant.operator_name) && (
                              <div className="d-flex align-items-center">
                                <User size={14} className="text-muted me-1" />
                                {participant.display_name || participant.operator_name}
                              </div>
                            )}
                          </td>
                          <td>
                            {(participant.display_location || participant.operator_location) && (
                              <div className="d-flex align-items-center">
                                <MapPin size={12} className="text-muted me-1" />
                                <div className="small text-muted">
                                  {participant.display_location || participant.operator_location}
                                </div>
                              </div>
                            )}
                          </td>
                          <td>
                            {participant.check_in_time && (
                              <div className="d-flex align-items-center text-success">
                                <Play size={12} className="me-1" />
                                {participant.check_in_time}
                              </div>
                            )}
                          </td>
                          <td>
                            {participant.check_out_time && (
                              <div className="d-flex align-items-center text-danger">
                                <Square size={12} className="me-1" />
                                {participant.check_out_time}
                              </div>
                            )}
                          </td>
                          <td>
                            {participant.notes && (
                              <div className="small text-muted">{participant.notes}</div>
                            )}
                          </td>
                          <td>
                            <div className="d-flex gap-1">
                              <button 
                                className="btn btn-sm btn-outline-primary"
                                onClick={() => handleEditParticipant(participant)}
                              >
                                <Edit size={14} />
                              </button>
                              <button 
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => handleRemoveParticipant(participant)}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-4">
                  <Users size={48} className="text-muted mb-3" />
                  <p className="text-muted">No participants recorded yet</p>
                  <button 
                    className="btn btn-primary"
                    onClick={() => {
                      setShowAddParticipant(true);
                      // Initialize form with default values
                      participantForm.setValue('check_in_time', getCurrentTime());
                      participantForm.setValue('check_out_time', '');
                      participantForm.setValue('notes', '');
                      participantForm.setValue('call_sign', '');
                      participantForm.setValue('operator_id', '');
                      // Focus on the call sign input after a short delay
                      setTimeout(() => {
                        if (callSignInputRef.current) {
                          callSignInputRef.current.focus();
                        }
                      }, 100);
                    }}
                  >
                    <UserPlus size={16} className="me-2" />
                    Add First Participant
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Traffic Tab */}
          {activeTab === 'traffic' && (
            <div>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h3>Session Traffic</h3>
                <button 
                  className="btn btn-primary"
                  onClick={() => setShowAddTraffic(true)}
                >
                  <Send size={16} className="me-2" />
                  Add Traffic
                </button>
              </div>

              {/* Add Traffic Form */}
              {showAddTraffic && (
                <div className="card mb-4">
                  <div className="card-header">
                    <h4>Add Traffic Record</h4>
                  </div>
                  <div className="card-body">
                    <form onSubmit={trafficForm.handleSubmit(onSubmitTraffic)}>
                      <div className="form-row">
                        <div className="form-group">
                          <label className="form-label">From Call Sign / Operator Search</label>
                          <div className="autocomplete-container" ref={fromCallSignInputRef}>
                            <div className="input-group">
                              <input
                                type="text"
                                className="form-control"
                                placeholder="Type call sign to search operators or enter new..."
                                value={fromCallSignInput}
                                onChange={handleFromCallSignInputChange}
                                onFocus={() => {
                                  if (filteredFromOperators.length > 0) {
                                    setShowFromSuggestions(true);
                                  }
                                }}
                                style={{ textTransform: 'uppercase' }}
                              />
                              {(selectedFromOperator || fromCallSignInput) && (
                                <button 
                                  type="button"
                                  className="btn btn-outline-secondary"
                                  onClick={clearFromSelection}
                                  title="Clear selection"
                                >
                                  <X size={16} />
                                </button>
                              )}
                            </div>
                            
                            {/* Autocomplete Suggestions */}
                            {showFromSuggestions && filteredFromOperators.length > 0 && (
                              <div className="autocomplete-suggestions">
                                {filteredFromOperators.map(operator => (
                                  <div
                                    key={operator.id}
                                    className="autocomplete-suggestion"
                                    onClick={() => handleFromOperatorSelect(operator)}
                                  >
                                    <div className="d-flex align-items-center">
                                      <Radio size={14} className="text-primary me-2" />
                                      <div>
                                        <strong>{operator.call_sign}</strong>
                                        {operator.name && (
                                          <span className="text-muted ms-2">- {operator.name}</span>
                                        )}
                                        {operator.location && (
                                          <div className="small text-muted">{operator.location}</div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                            
                            {/* Selected Operator Display */}
                            {selectedFromOperator && (
                              <div className="selected-operator mt-2">
                                <div className="alert alert-success mb-0">
                                  <div className="d-flex align-items-center">
                                    <User size={16} className="me-2" />
                                    <div>
                                      <strong>{selectedFromOperator.call_sign}</strong>
                                      {selectedFromOperator.name && (
                                        <span className="ms-2">- {selectedFromOperator.name}</span>
                                      )}
                                      {selectedFromOperator.location && (
                                        <div className="small">{selectedFromOperator.location}</div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                            
                            <div className="form-text">
                              Type 2+ characters to search existing operators, or enter any call sign.
                            </div>
                          </div>
                          
                          {/* Hidden form fields for react-hook-form */}
                          <input type="hidden" {...trafficForm.register('from_operator_id')} />
                          <input type="hidden" {...trafficForm.register('from_call')} />
                        </div>
                        
                        <div className="form-group">
                          <label className="form-label">To Call Sign / Operator Search</label>
                          <div className="autocomplete-container" ref={toCallSignInputRef}>
                            <div className="input-group">
                              <input
                                type="text"
                                className="form-control"
                                placeholder="Type call sign to search operators or enter new..."
                                value={toCallSignInput}
                                onChange={handleToCallSignInputChange}
                                onFocus={() => {
                                  if (filteredToOperators.length > 0) {
                                    setShowToSuggestions(true);
                                  }
                                }}
                                style={{ textTransform: 'uppercase' }}
                              />
                              {(selectedToOperator || toCallSignInput) && (
                                <button 
                                  type="button"
                                  className="btn btn-outline-secondary"
                                  onClick={clearToSelection}
                                  title="Clear selection"
                                >
                                  <X size={16} />
                                </button>
                              )}
                            </div>
                            
                            {/* Autocomplete Suggestions */}
                            {showToSuggestions && filteredToOperators.length > 0 && (
                              <div className="autocomplete-suggestions">
                                {filteredToOperators.map(operator => (
                                  <div
                                    key={operator.id}
                                    className="autocomplete-suggestion"
                                    onClick={() => handleToOperatorSelect(operator)}
                                  >
                                    <div className="d-flex align-items-center">
                                      <Radio size={14} className="text-primary me-2" />
                                      <div>
                                        <strong>{operator.call_sign}</strong>
                                        {operator.name && (
                                          <span className="text-muted ms-2">- {operator.name}</span>
                                        )}
                                        {operator.location && (
                                          <div className="small text-muted">{operator.location}</div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                            
                            {/* Selected Operator Display */}
                            {selectedToOperator && (
                              <div className="selected-operator mt-2">
                                <div className="alert alert-success mb-0">
                                  <div className="d-flex align-items-center">
                                    <User size={16} className="me-2" />
                                    <div>
                                      <strong>{selectedToOperator.call_sign}</strong>
                                      {selectedToOperator.name && (
                                        <span className="ms-2">- {selectedToOperator.name}</span>
                                      )}
                                      {selectedToOperator.location && (
                                        <div className="small">{selectedToOperator.location}</div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                            
                            <div className="form-text">
                              Type 2+ characters to search existing operators, or enter any call sign.
                            </div>
                          </div>
                          
                          {/* Hidden form fields for react-hook-form */}
                          <input type="hidden" {...trafficForm.register('to_operator_id')} />
                          <input type="hidden" {...trafficForm.register('to_call')} />
                        </div>
                      </div>

                      <div className="form-row">
                        <div className="form-group">
                          <label className="form-label">Message Type</label>
                          <select className="form-control" {...trafficForm.register('message_type')}>
                            {messageTypes.map(type => (
                              <option key={type} value={type}>{type}</option>
                            ))}
                          </select>
                        </div>
                        
                        <div className="form-group">
                          <label className="form-label">Precedence</label>
                          <select className="form-control" {...trafficForm.register('precedence')}>
                            {precedences.map(prec => (
                              <option key={prec} value={prec}>{prec}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Message Content</label>
                        <textarea
                          className="form-control"
                          rows="3"
                          placeholder="Message content..."
                          {...trafficForm.register('message_text')}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Notes</label>
                        <textarea
                          className="form-control"
                          rows="2"
                          placeholder="Additional notes..."
                          {...trafficForm.register('notes')}
                        />
                      </div>

                      <div className="d-flex gap-2">
                        <button 
                          type="submit" 
                          className="btn btn-primary"
                          disabled={addTrafficMutation.isLoading}
                        >
                          {addTrafficMutation.isLoading ? (
                            <>
                              <Loader size={16} className="animate-spin" />
                              Adding...
                            </>
                          ) : (
                            <>
                              <Send size={16} className="me-2" />
                              Add Traffic
                            </>
                          )}
                        </button>
                        <button 
                          type="button" 
                          className="btn btn-secondary"
                          onClick={() => {
                            setShowAddTraffic(false);
                            trafficForm.reset();
                            // Clear traffic form state
                            setFromCallSignInput('');
                            setToCallSignInput('');
                            setSelectedFromOperator(null);
                            setSelectedToOperator(null);
                            setShowFromSuggestions(false);
                            setShowToSuggestions(false);
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Traffic List */}
              {sessionData.traffic && sessionData.traffic.length > 0 ? (
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>From</th>
                        <th>To</th>
                        <th>Type</th>
                        <th>Precedence</th>
                        <th>Message</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessionData.traffic.map((traffic) => (
                        <tr 
                          key={traffic.id}
                          style={{ cursor: 'pointer' }}
                          onClick={() => {
                            // Show traffic details in an alert or modal
                            const details = [
                              `Time: ${new Date(traffic.created_at).toLocaleString()}`,
                              `From: ${traffic.from_call || traffic.from_operator_call}${traffic.from_operator_name ? ` (${traffic.from_operator_name})` : ''}`,
                              `To: ${traffic.to_call || traffic.to_operator_call}${traffic.to_operator_name ? ` (${traffic.to_operator_name})` : ''}`,
                              `Type: ${traffic.message_type}`,
                              `Precedence: ${traffic.precedence}`,
                              traffic.message_number ? `Message Number: ${traffic.message_number}` : '',
                              traffic.time_received ? `Time Received: ${traffic.time_received}` : '',
                              traffic.handled_by ? `Handled By: ${traffic.handled_by}` : '',
                              traffic.message_text ? `Message: ${traffic.message_text}` : '',
                              traffic.notes ? `Notes: ${traffic.notes}` : ''
                            ].filter(Boolean).join('\n');
                            
                            alert(details);
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = ''}
                          title="Click to view full traffic details"
                        >
                          <td>
                            <div className="small text-muted">
                              {new Date(traffic.created_at).toLocaleTimeString()}
                            </div>
                          </td>
                          <td>
                            <strong>
                              {traffic.from_call || traffic.from_operator_call}
                            </strong>
                            {traffic.from_operator_name && (
                              <div className="small text-muted">{traffic.from_operator_name}</div>
                            )}
                          </td>
                          <td>
                            <strong>
                              {traffic.to_call || traffic.to_operator_call}
                            </strong>
                            {traffic.to_operator_name && (
                              <div className="small text-muted">{traffic.to_operator_name}</div>
                            )}
                          </td>
                          <td>
                            <span className="badge bg-info">{traffic.message_type}</span>
                          </td>
                          <td>
                            <span className={`badge ${
                              traffic.precedence === 'Emergency' ? 'bg-danger' :
                              traffic.precedence === 'Priority' ? 'bg-warning' :
                              traffic.precedence === 'Welfare' ? 'bg-success' : 'bg-secondary'
                            }`}>
                              {traffic.precedence}
                            </span>
                          </td>
                          <td>
                            {traffic.message_text && (
                              <div className="small">{traffic.message_text}</div>
                            )}
                            {traffic.notes && (
                              <div className="small text-muted mt-1">{traffic.notes}</div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-4">
                  <MessageSquare size={48} className="text-muted mb-3" />
                  <p className="text-muted">No traffic recorded yet</p>
                  <button 
                    className="btn btn-primary"
                    onClick={() => setShowAddTraffic(true)}
                  >
                    <Send size={16} className="me-2" />
                    Add First Traffic
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Pre-Check-In Modal */}
      {showPreCheckIn && (
        <div className="modal-overlay" onClick={() => setShowPreCheckIn(false)}>
          <div className="modal-dialog modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-header">
                <h4 className="modal-title">
                  <User size={20} className="me-2" />
                  BRARS Pre-Check-In List
                </h4>
                <button 
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => setShowPreCheckIn(false)}
                >
                  <X size={16} />
                </button>
              </div>
              
              <div className="modal-body">
                {preCheckInData && (
                  <>
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <div>
                        <p className="mb-1">
                          <strong>{preCheckInData.participants.length}</strong> participants pre-checked-in
                        </p>
                        <p className="small text-muted mb-0">
                          Fetched: {new Date(preCheckInData.fetchedAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="d-flex gap-2">
                        <button 
                          className="btn btn-sm btn-outline-primary"
                          onClick={handleSelectAllPreCheckIn}
                        >
                          <Square size={14} className="me-1" />
                          {selectedPreCheckIns.size === preCheckInData.participants.length ? 'Deselect All' : 'Select All'}
                        </button>
                        <button 
                          className="btn btn-sm btn-success"
                          onClick={handleAddSelectedPreCheckIn}
                          disabled={selectedPreCheckIns.size === 0 || addMultipleParticipantsMutation.isLoading}
                        >
                          {addMultipleParticipantsMutation.isLoading ? (
                            <>
                              <Loader size={14} className="animate-spin me-1" />
                              Processing...
                            </>
                          ) : (
                            <>
                              <UserPlus size={14} className="me-1" />
                              Add Selected ({selectedPreCheckIns.size})
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="table-container">
                      <table className="table">
                        <thead>
                          <tr>
                            <th width="50">
                              <input
                                type="checkbox"
                                checked={selectedPreCheckIns.size === preCheckInData.participants.length && preCheckInData.participants.length > 0}
                                onChange={handleSelectAllPreCheckIn}
                              />
                            </th>
                            <th>Call Sign</th>
                            <th>Name</th>
                            <th>Location</th>
                            <th>Announce</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {preCheckInData.participants.map((participant) => (
                            <tr key={participant.callSign}>
                              <td>
                                <input
                                  type="checkbox"
                                  checked={selectedPreCheckIns.has(participant.callSign)}
                                  onChange={(e) => handlePreCheckInSelect(participant, e.target.checked)}
                                />
                              </td>
                              <td>
                                <div className="d-flex align-items-center">
                                  <Radio size={14} className="text-primary me-2" />
                                  <div>
                                    <strong>{participant.callSign}</strong>
                                    {!participant.hasOperatorRecord && (
                                      <div className="small text-info">
                                        <Search size={10} className="me-1" />
                                        Will lookup QRZ
                                      </div>
                                    )}
                                    {participant.hasOperatorRecord && (
                                      <div className="small text-success">
                                        <User size={10} className="me-1" />
                                        In database
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td>{participant.firstName}</td>
                              <td>
                                {participant.location && (
                                  <div className="d-flex align-items-center">
                                    <MapPin size={12} className="text-muted me-1" />
                                    {participant.location}
                                  </div>
                                )}
                              </td>
                              <td>
                                <span className={`badge ${participant.announce ? 'bg-success' : 'bg-secondary'}`}>
                                  {participant.announce ? 'Yes' : 'No'}
                                </span>
                              </td>
                              <td>
                                <button 
                                  className="btn btn-sm btn-outline-primary"
                                  onClick={() => handleAddSinglePreCheckIn(participant)}
                                  disabled={addSinglePreCheckInMutation.isLoading}
                                >
                                  {addSinglePreCheckInMutation.isLoading ? (
                                    <Loader size={12} className="animate-spin" />
                                  ) : (
                                    <>
                                      <UserPlus size={12} className="me-1" />
                                      Add
                                    </>
                                  )}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {preCheckInData.participants.length === 0 && (
                      <div className="text-center py-4">
                        <User size={48} className="text-muted mb-3" />
                        <p className="text-muted">No pre-checked-in participants found</p>
                      </div>
                    )}
                  </>
                )}
              </div>
              
              <div className="modal-footer">
                <button 
                  className="btn btn-secondary"
                  onClick={() => setShowPreCheckIn(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SessionDetail;