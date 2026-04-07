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
  Download,
  FileText,
  RefreshCw,
  Headphones,
  Check,
  ExternalLink
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useSettings } from '../contexts/SettingsContext';
import { formatDateLocal, parseDateLocal } from '../utils/dateUtils';
import { getAppTimezone } from '../utils/dateUtils';

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
  const [showEcholink, setShowEcholink] = useState(false);
  const [echolinkData, setEcholinkData] = useState(null);
  const [selectedEcholinks, setSelectedEcholinks] = useState(new Set());
  const [participantSort, setParticipantSort] = useState({ field: 'check_in_time', direction: 'desc' });
  const [showNetScript, setShowNetScript] = useState(false);
  const [editingPreferredName, setEditingPreferredName] = useState(null);
  const [preferredNameValue, setPreferredNameValue] = useState('');
  const [groupAck, setGroupAck] = useState({1: false, 2: false, 3: false, 4: false, 5: false, 6: false});
  const [participantSearch, setParticipantSearch] = useState('');
  const [elapsedTime, setElapsedTime] = useState('');
  const { getSetting } = useSettings();

  // Fetch tomorrow's scheduled net for script variables
  const { data: upcomingData } = useQuery(
    'upcoming-nets-tomorrow',
    () => {
      // Calculate tomorrow in the app timezone
      const tz = getAppTimezone() || 'America/New_York';
      const nowInTz = new Date(new Date().toLocaleString('en-US', { timeZone: tz }));
      nowInTz.setDate(nowInTz.getDate() + 1);
      const startDate = nowInTz.getFullYear() + '-' + String(nowInTz.getMonth() + 1).padStart(2, '0') + '-' + String(nowInTz.getDate()).padStart(2, '0');
      return axios.get('/api/schedules/calendar/upcoming', { params: { days: 1, start_date: startDate } }).then(res => res.data);
    }
  );

  const [participantFlags, setParticipantFlags] = useState({
    flag_comment: false,
    flag_traffic: false,
    flag_echolink: false,
    flag_announcement: false
  });
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

  // Running session timer
  useEffect(() => {
    if (!sessionData?.start_time || sessionData?.end_time) {
      setElapsedTime('');
      return;
    }
    const updateTimer = () => {
      const now = new Date();
      const [h, m, s] = sessionData.start_time.split(':').map(Number);
      const start = new Date();
      start.setHours(h, m, s || 0, 0);
      const diff = Math.max(0, Math.floor((now - start) / 1000));
      const hrs = Math.floor(diff / 3600);
      const mins = Math.floor((diff % 3600) / 60);
      const secs = diff % 60;
      setElapsedTime((hrs > 0 ? hrs + ':' : '') + String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0'));
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [sessionData?.start_time, sessionData?.end_time]);

  // Fetch operators for dropdowns
  const { data: operatorsData } = useQuery(
    'operators-list',
    () => axios.get('/api/operators?limit=1000').then(res => res.data.operators)
  );

  // Inline echolink auto-refresh (every 30 seconds, only when participant form is open)
  const { data: inlineEcholinkData, isFetching: inlineEcholinkFetching } = useQuery(
    'inline-echolink',
    () => axios.get('/api/echolink').then(res => res.data),
    {
      enabled: showAddParticipant,
      refetchInterval: 30000,
      refetchIntervalInBackground: false,
      retry: 3,
      retryDelay: 5000,
      onError: () => {} // Silently handle errors, keep refetching
    }
  );

  const operators = useMemo(() => operatorsData || [], [operatorsData]);

  // Sorted participants list
  const sortedParticipants = useMemo(() => {
    if (!sessionData?.participants) return [];
    const sorted = [...sessionData.participants];
    const { field, direction } = participantSort;
    sorted.sort((a, b) => {
      let valA, valB;
      switch (field) {
        case 'call_sign':
          valA = (a.display_call_sign || a.call_sign || '').toLowerCase();
          valB = (b.display_call_sign || b.call_sign || '').toLowerCase();
          break;
        case 'name':
          valA = (a.display_name || a.operator_name || a.name || '').toLowerCase();
          valB = (b.display_name || b.operator_name || b.name || '').toLowerCase();
          break;
        case 'location':
          valA = (a.display_location || a.operator_location || '').toLowerCase();
          valB = (b.display_location || b.operator_location || '').toLowerCase();
          break;
        case 'check_in_time':
        default:
          valA = a.check_in_time || '';
          valB = b.check_in_time || '';
          break;
      }
      if (valA < valB) return direction === 'asc' ? -1 : 1;
      if (valA > valB) return direction === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [sessionData?.participants, participantSort]);

  const handleParticipantSort = (field) => {
    setParticipantSort(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const SortIndicator = ({ field }) => {
    if (participantSort.field !== field) return <span className="text-muted ms-1" style={{ opacity: 0.3 }}>⇅</span>;
    return <span className="ms-1">{participantSort.direction === 'asc' ? '▲' : '▼'}</span>;
  };

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
  // Extract just the call sign portion (strip /C /T /E /A flags) for lookups
  const callSignOnly = callSignInput.split('/')[0].trim();

  useEffect(() => {
    if (callSignOnly.length >= 2) {
      const filtered = operators.filter(op => 
        op.call_sign.toUpperCase().includes(callSignOnly.toUpperCase())
      ).slice(0, 10);
      setFilteredOperators(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setFilteredOperators([]);
      setShowSuggestions(false);
    }
  }, [callSignOnly, operators]);

  // Auto QRZ lookup after user stops typing (debounced)
  useEffect(() => {
    if (callSignOnly.length >= 3 && !selectedOperator && !qrzLookupData) {
      const existingOperator = operators.find(op => 
        op.call_sign.toUpperCase() === callSignOnly.toUpperCase()
      );
      
      if (!existingOperator) {
        const timeoutId = setTimeout(() => {
          console.log('Auto-triggering QRZ lookup for:', callSignOnly);
          qrzLookupMutation.mutate(callSignOnly.toUpperCase());
        }, 2000);
        
        return () => clearTimeout(timeoutId);
      }
    }
  }, [callSignOnly, operators, selectedOperator, qrzLookupData, qrzLookupMutation]);

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
        participantForm.setValue('check_in_time', getCurrentTime());
        setQrzLookupData(null);
        setSelectedOperator(null);
        setCallSignInput('');
        setShowManualEntry(false);
        setShowSuggestions(false);
        setParticipantFlags({ flag_comment: false, flag_traffic: false, flag_echolink: false, flag_announcement: false });
        
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
        // Reset form for next entry even on error (e.g., duplicate)
        participantForm.reset();
        participantForm.setValue('check_in_time', getCurrentTime());
        setQrzLookupData(null);
        setSelectedOperator(null);
        setCallSignInput('');
        setShowManualEntry(false);
        setShowSuggestions(false);
        setParticipantFlags({ flag_comment: false, flag_traffic: false, flag_echolink: false, flag_announcement: false });
        setTimeout(() => { if (callSignInputRef.current) callSignInputRef.current.focus(); }, 100);
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

  // Patch participant (lightweight: acknowledged, preferred_name)
  const patchParticipantMutation = useMutation(
    ({ participantId, data }) =>
      axios.patch(`/api/sessions/${id}/participants/${participantId}`, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['session', id]);
      },
      onError: (error) => {
        toast.error(error.response?.data?.error || 'Failed to update');
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

  // Delete traffic mutation
  const deleteTrafficMutation = useMutation(
    (trafficId) => axios.delete(`/api/sessions/${id}/traffic/${trafficId}`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['session', id]);
        toast.success('Traffic deleted');
      },
      onError: (error) => {
        toast.error(error.response?.data?.error || 'Failed to delete traffic');
      }
    }
  );

  // Update traffic mutation
  const [editingTraffic, setEditingTraffic] = useState(null);
  const updateTrafficMutation = useMutation(
    ({ trafficId, trafficData }) => axios.put(`/api/sessions/${id}/traffic/${trafficId}`, trafficData),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['session', id]);
        toast.success('Traffic updated');
        setEditingTraffic(null);
        setShowAddTraffic(false);
        trafficForm.reset();
        setFromCallSignInput('');
        setToCallSignInput('');
        setSelectedFromOperator(null);
        setSelectedToOperator(null);
      },
      onError: (error) => {
        toast.error(error.response?.data?.error || 'Failed to update traffic');
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

  // Submit net report mutation
  const submitNetReportMutation = useMutation(
    () => axios.post(`/api/sessions/${id}/submit-net-report`),
    {
      onSuccess: (response) => {
        const data = response.data.data;
        toast.success(`Net report submitted: ${data.callSign} - ${data.checkins} check-ins, ${data.traffic} traffic`);
      },
      onError: (error) => {
        toast.error(error.response?.data?.error || 'Failed to submit net report');
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
    const rawCallSign = selectedOperator?.call_sign || data.call_sign || callSignInput.trim();
    const { callSign: finalCallSign, flags: parsedFlags } = parseCallSignFlags(rawCallSign);
    const finalOperatorId = selectedOperator?.id || data.operator_id;
    
    // Merge parsed flags with any flags already in data or state
    const mergedFlags = {
      flag_comment: data.flag_comment || participantFlags.flag_comment || parsedFlags.flag_comment,
      flag_traffic: data.flag_traffic || participantFlags.flag_traffic || parsedFlags.flag_traffic,
      flag_echolink: data.flag_echolink || participantFlags.flag_echolink || parsedFlags.flag_echolink,
      flag_announcement: data.flag_announcement || participantFlags.flag_announcement || parsedFlags.flag_announcement
    };
    
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
      call_sign: finalCallSign,
      ...mergedFlags
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
    // Include the call signs from the autocomplete inputs
    const trafficData = {
      ...data,
      from_call: selectedFromOperator?.call_sign || fromCallSignInput.trim() || data.from_call,
      to_call: selectedToOperator?.call_sign || toCallSignInput.trim() || data.to_call
    };
    if (editingTraffic) {
      updateTrafficMutation.mutate({ trafficId: editingTraffic.id, trafficData });
    } else {
      addTrafficMutation.mutate(trafficData);
    }
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
    
    // Set flag state from participant data
    setParticipantFlags({
      flag_comment: participant.flag_comment || false,
      flag_traffic: participant.flag_traffic || false,
      flag_echolink: participant.flag_echolink || false,
      flag_announcement: participant.flag_announcement || false
    });
    
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
    
    // Parse flags from input
    const { callSign, flags } = parseCallSignFlags(value);
    setParticipantFlags(flags);
    
    // Update form value with just the call sign (without flags)
    participantForm.setValue('call_sign', callSign);
    participantForm.setValue('operator_id', '');
  };

  const handleCallSignKeyDown = (e) => {
    // Ctrl+1 through Ctrl+5 to select from suggestions dropdown
    if (e.ctrlKey && e.key >= '1' && e.key <= '5') {
      e.preventDefault();
      const idx = parseInt(e.key) - 1;
      if (filteredOperators[idx]) {
        handleOperatorSelect(filteredOperators[idx]);
        setShowSuggestions(false);
      }
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      
      // Parse flags from input
      const { callSign: parsedCallSign, flags } = parseCallSignFlags(callSignInput.trim());
      setParticipantFlags(flags);
      
      const callSign = parsedCallSign;
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
            notes: participantForm.getValues('notes') || '',
            ...flags
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
          notes: participantForm.getValues('notes') || '',
          ...flags
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
    
    // Auto-submit the participant
    const checkInTime = participantForm.getValues('check_in_time') || getCurrentTime();
    addParticipantMutation.mutate({
      operator_id: operator.id,
      call_sign: operator.call_sign,
      check_in_time: checkInTime,
      check_out_time: participantForm.getValues('check_out_time') || '',
      notes: participantForm.getValues('notes') || '',
      flag_comment: participantFlags.flag_comment,
      flag_traffic: participantFlags.flag_traffic,
      flag_echolink: participantFlags.flag_echolink,
      flag_announcement: participantFlags.flag_announcement
    });
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
    const notInSession = preCheckInData?.participants.filter(p => 
      !sessionData?.participants?.some(sp => sp.call_sign?.toUpperCase() === p.callSign?.toUpperCase())
    ) || [];
    if (selectedPreCheckIns.size === notInSession.length && notInSession.length > 0) {
      setSelectedPreCheckIns(new Set());
    } else {
      setSelectedPreCheckIns(new Set(notInSession.map(p => p.callSign)));
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
          notes: participantForm.getValues('notes') || '',
          ...participantFlags
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
    return new Date().toTimeString().slice(0, 8);
  };

  // Auto-update check-in time every second when participant form is open
  useEffect(() => {
    if (!showAddParticipant || editingParticipant) return;
    const interval = setInterval(() => {
      const now = new Date();
      const currentVal = participantForm.getValues('check_in_time');
      // Only update if within 2 seconds of current time (user hasn't manually edited)
      if (currentVal) {
        const [h, m, s] = currentVal.split(':').map(Number);
        const formTime = new Date();
        formTime.setHours(h, m, s || 0, 0);
        const diff = Math.abs(now - formTime);
        if (diff < 2000) {
          participantForm.setValue('check_in_time', now.toTimeString().slice(0, 8));
        }
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [showAddParticipant, editingParticipant, participantForm]);

  // Parse /flags from call sign input (e.g., "W1AW/C/T" -> callSign: "W1AW", flags)
  const parseCallSignFlags = (input) => {
    const flags = {
      flag_comment: false,
      flag_traffic: false,
      flag_echolink: false,
      flag_announcement: false
    };
    
    // Split by / and process each part
    const parts = input.trim().split('/');
    const callSign = parts[0].trim();
    
    for (let i = 1; i < parts.length; i++) {
      const flag = parts[i].trim().toUpperCase();
      if (flag === 'C') flags.flag_comment = true;
      else if (flag === 'T') flags.flag_traffic = true;
      else if (flag === 'E') flags.flag_echolink = true;
      else if (flag === 'A') flags.flag_announcement = true;
    }
    
    return { callSign, flags };
  };

  // Process net script template with session data
  const processNetScript = () => {
    const template = getSetting('net_script_template', '');
    if (!template || !sessionData) return '';
    const localDate = parseDateLocal(sessionData.session_date);
    const ncOperator = operators.find(op => op.call_sign?.toUpperCase() === (sessionData.net_control_call || '').toUpperCase());
    const tz = getAppTimezone();
    const dayName = localDate.toLocaleDateString('en-US', { weekday: 'long', ...(tz ? { timeZone: tz } : {}) });

    // Tomorrow's scheduled NC from schedule data
    const tomorrowNets = upcomingData?.upcoming_nets || [];
    const tomorrowNet = tomorrowNets[0];
    const tomorrowFirstName = tomorrowNet?.assigned_operator?.name ? tomorrowNet.assigned_operator.name.split(' ')[0] : '';
    const tomorrowCallSign = tomorrowNet?.assigned_operator?.call_sign || '';

    const groups = ['Alpha – Delta', 'Echo – Hotel', 'India – Lima', 'Mike – Papa', 'Quebec – Tango', 'Uniform – Zulu'];
    const dayStartIndex = { 'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 0 };
    const startIdx = dayStartIndex[dayName] || 0;

    const vars = {
      '{FIRSTNAME}': (sessionData.net_control_name || '').split(' ')[0] || '',
      '{FULLNAME}': sessionData.net_control_name || '',
      '{CALLSIGN}': sessionData.net_control_call || '',
      '{CITY}': ncOperator?.city || '',
      '{DATE}': formatDateLocal(sessionData.session_date),
      '{DAY_OF_WEEK}': dayName,
      '{FREQUENCY}': sessionData.frequency || '',
      '{MODE}': sessionData.mode || 'FM',
      '{NET_TYPE}': sessionData.net_type || 'Regular',
      '{CHECKINS}': String(sessionData.participants?.length || 0),
      '{TRAFFIC}': String(sessionData.traffic?.length || 0),
      '{START_TIME}': sessionData.start_time || '',
      '{END_TIME}': sessionData.end_time || '',
      '{POWER}': sessionData.power || '',
      '{ANTENNA}': sessionData.antenna || '',
      '{STARTING_GROUP}': groups[startIdx],
      '{TOMORROW_FIRSTNAME}': tomorrowFirstName,
      '{TOMORROW_CALLSIGN}': tomorrowCallSign,
    };
    for (let i = 0; i < 6; i++) { vars['{GROUP_' + (i + 1) + '}'] = groups[(startIdx + i) % 6]; }

    let result = template;
    Object.entries(vars).forEach(([key, value]) => { result = result.replaceAll(key, value); });
    return result;
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
        <div>
          <button
            className="btn btn-outline-secondary"
            onClick={() => {
              const template = getSetting('net_script_template', '');
              if (!template) { toast.error('No net script template configured. Go to Settings → External Services.'); return; }
              setShowNetScript(true);
            }}
          >
            <FileText size={16} className="me-2" />Net Script
          </button>
          <button
            className="btn btn-success"
            onClick={() => {
              if (window.confirm(`Submit net report for ${sessionData.net_control_call} with ${sessionData.participants?.length || 0} check-ins?`)) {
                submitNetReportMutation.mutate();
              }
            }}
            disabled={submitNetReportMutation.isLoading}
          >
            {submitNetReportMutation.isLoading ? (
              <><Loader size={16} className="animate-spin me-2" />Submitting...</>
            ) : (
              <><Send size={16} className="me-2" />Submit Net Report</>
            )}
          </button>
          <button className="btn btn-outline-secondary" onClick={() => window.open('/api/sessions/' + id + '/export-csv', '_blank')}>
            <Download size={16} className="me-2" />Export CSV
          </button>
        </div>
      </div>

      {/* Net Script Panel */}
      {showNetScript && (
        <div className="card mb-4">
          <div className="card-header d-flex justify-content-between align-items-center">
            <h2 className="card-title mb-0"><FileText size={20} className="me-2" />Net Script</h2>
            <div className="d-flex gap-2">
              <button className="btn btn-outline-primary btn-sm" title="Pop out" onClick={() => {
                const groups = ['Alpha – Delta', 'Echo – Hotel', 'India – Lima', 'Mike – Papa', 'Quebec – Tango', 'Uniform – Zulu'];
                const tz = getAppTimezone();
                const scriptDate = parseDateLocal(sessionData?.session_date);
                const dn = scriptDate.toLocaleDateString('en-US', { weekday: 'long', ...(tz ? { timeZone: tz } : {}) });
                const dsi = { 'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 0 };
                const si = dsi[dn] || 0;
                const checklistHtml = '<div style="padding:8px 0;display:flex;flex-wrap:wrap;gap:12px;align-items:center">' +
                  [1,2,3,4,5,6].map(i => {
                    const gn = groups[(si + i - 1) % 6];
                    return '<label style="display:inline-flex;align-items:center;gap:4px;cursor:pointer;font-size:0.95rem"><input type="checkbox" style="width:16px;height:16px;cursor:pointer" onchange="var s=this.nextElementSibling;if(this.checked){s.style.textDecoration=\'line-through\';s.style.opacity=\'0.5\'}else{s.style.textDecoration=\'none\';s.style.opacity=\'1\'}"><span>' + gn + '</span></label>';
                  }).join('') + '</div>';
                let scriptHtml = processNetScript()
                  .replace(/\{GROUP_CHECKLIST\}/g, checklistHtml)
                  .replace(/\[i\]([\s\S]*?)\[\/i\]/g, '<em>$1</em>')
                  .replace(/\[b\]([\s\S]*?)\[\/b\]/g, '<strong>$1</strong>');
                const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
                const hasInline = processNetScript().includes('{GROUP_CHECKLIST}');
                const appendChecklist = hasInline ? '' : '<div style="margin-top:16px;padding-top:12px;border-top:1px solid ' + (isDark ? '#30363d' : '#ddd') + '">' + checklistHtml + '</div>';
                const popout = window.open('', 'NetScript', 'width=700,height=800,scrollbars=yes,resizable=yes');
                if (popout) {
                  popout.document.write('<!DOCTYPE html><html><head><title>Net Script - ' + (sessionData?.net_control_call || '') + '</title><style>body{font-family:-apple-system,sans-serif;font-size:1.05rem;line-height:1.8;padding:24px;background:' + (isDark ? '#0d1117' : '#fff') + ';color:' + (isDark ? '#c9d1d9' : '#1a1a1a') + '}pre{white-space:pre-wrap;word-wrap:break-word;font-family:inherit;margin:0}h1{font-size:1.2rem;margin-bottom:16px;padding-bottom:8px;border-bottom:1px solid ' + (isDark ? '#30363d' : '#ddd') + '}@media print{body{background:#fff;color:#000}}</style></head><body><h1>Net Script — ' + (sessionData?.net_control_call || '') + ' — ' + formatDateLocal(sessionData?.session_date) + '</h1><pre>' + scriptHtml + '</pre>' + appendChecklist + '</body></html>');
                  popout.document.close();
                }
              }}><ExternalLink size={14} /> Pop Out</button>
              <button className="btn btn-outline-secondary btn-sm" onClick={() => {
                navigator.clipboard.writeText(processNetScript().replace(/\[i\]/g, '').replace(/\[\/i\]/g, '').replace(/\[b\]/g, '').replace(/\[\/b\]/g, '').replace(/\{GROUP_CHECKLIST\}/g, ''));
                toast.success('Script copied');
              }}>Copy</button>
              <button className="btn btn-outline-secondary btn-sm" onClick={() => setShowNetScript(false)}><X size={14} /></button>
            </div>
          </div>
          <div className="card-body">
            {(() => {
              const scriptText = processNetScript();
              const formatHtml = (text) => text.replace(/\[i\]([\s\S]*?)\[\/i\]/g, '<em>$1</em>').replace(/\[b\]([\s\S]*?)\[\/b\]/g, '<strong>$1</strong>');
              const preStyle = { whiteSpace: 'pre-wrap', wordWrap: 'break-word', fontFamily: 'inherit', fontSize: '1.05rem', lineHeight: '1.8', margin: 0, color: 'inherit' };
              const groups = ['Alpha – Delta', 'Echo – Hotel', 'India – Lima', 'Mike – Papa', 'Quebec – Tango', 'Uniform – Zulu'];
              const tz = getAppTimezone();
              const scriptDate = parseDateLocal(sessionData?.session_date);
              const dn = scriptDate.toLocaleDateString('en-US', { weekday: 'long', ...(tz ? { timeZone: tz } : {}) });
              const dsi = { 'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 0 };
              const si = dsi[dn] || 0;
              const GroupChecklist = () => (
                <div style={{ padding: '8px 0', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
                  {[1,2,3,4,5,6].map(i => {
                    const gn = groups[(si + i - 1) % 6];
                    return (
                      <label key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '0.95rem' }}>
                        <input type="checkbox" checked={groupAck[i] || false} onChange={() => setGroupAck(prev => ({ ...prev, [i]: !prev[i] }))} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                        <span style={{ textDecoration: groupAck[i] ? 'line-through' : 'none', opacity: groupAck[i] ? 0.5 : 1 }}>{gn}</span>
                      </label>
                    );
                  })}
                </div>
              );
              if (scriptText.includes('{GROUP_CHECKLIST}')) {
                const parts = scriptText.split('{GROUP_CHECKLIST}');
                return parts.map((part, idx) => (
                  <React.Fragment key={idx}>
                    <pre style={preStyle} dangerouslySetInnerHTML={{ __html: formatHtml(part) }} />
                    {idx < parts.length - 1 && <GroupChecklist />}
                  </React.Fragment>
                ));
              } else {
                return (
                  <>
                    <pre style={preStyle} dangerouslySetInnerHTML={{ __html: formatHtml(scriptText) }} />
                    <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-color, #dee2e6)' }}><GroupChecklist /></div>
                  </>
                );
              }
            })()}
          </div>
        </div>
      )}

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
                      {elapsedTime && (
                        <span className="badge bg-success ms-2" style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                          {elapsedTime}
                        </span>
                      )}
                      {sessionData.start_time && !sessionData.end_time && (
                        <button
                          className="btn btn-sm btn-outline-danger ms-2"
                          onClick={async () => {
                            const endTime = new Date().toTimeString().slice(0, 8);
                            try {
                              await axios.put('/api/sessions/' + id, {
                                ...sessionData,
                                end_time: endTime,
                                net_control_call: sessionData.net_control_call
                              });
                              queryClient.invalidateQueries(['session', id]);
                              toast.success('Net ended at ' + endTime);
                              if (window.confirm('Submit net report now?')) {
                                try {
                                  await axios.post('/api/sessions/' + id + '/submit-net-report');
                                  toast.success('Net report submitted');
                                } catch (re) {
                                  toast.error(re.response?.data?.error || 'Net report submission failed');
                                }
                              }
                            } catch (e) {
                              toast.error('Failed to end net');
                            }
                          }}
                        >
                          <Square size={12} className="me-1" />
                          End Net
                        </button>
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

                {sessionData.net_count > 0 && (
                  <div className="info-item">
                    <strong>NC Net Count:</strong>
                    <span className="badge bg-secondary ms-2">{sessionData.net_count}</span>
                  </div>
                )}

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
                      setParticipantFlags({ flag_comment: false, flag_traffic: false, flag_echolink: false, flag_announcement: false });
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
                <div className="row mb-4">
                <div className="col-md-8">
                <div className="card">
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
                              {filteredOperators.map((operator, idx) => (
                                <div
                                  key={operator.id}
                                  className="autocomplete-suggestion"
                                  onClick={() => handleOperatorSelect(operator)}
                                >
                                  <div className="d-flex align-items-center">
                                    {idx < 5 && (
                                      <span className="badge bg-secondary me-1" style={{ fontSize: '0.65rem', padding: '1px 4px' }}>
                                        ^{idx + 1}
                                      </span>
                                    )}
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
                                Looking up {callSignOnly} in QRZ database...
                              </div>
                            ) : callSignOnly.length >= 2 && filteredOperators.length === 0 && !selectedOperator && !qrzLookupData ? (
                              <div className="text-muted">
                                No existing operators found. {callSignOnly.length >= 3 ? 'Auto-lookup from QRZ in progress...' : 'Type more characters for auto QRZ lookup.'}
                              </div>
                            ) : (
                              'Type 2+ characters to search. Add /C /T /E /A for flags.'
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
                            step="1"
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

                      {/* Participant Flags */}
                      <div className="form-group">
                        <label className="form-label">Flags</label>
                        <div className="d-flex flex-wrap gap-3">
                          <div className="form-check">
                            <input
                              type="checkbox"
                              className="form-check-input"
                              id="flag_comment"
                              checked={participantFlags.flag_comment}
                              onChange={(e) => setParticipantFlags(prev => ({ ...prev, flag_comment: e.target.checked }))}
                            />
                            <label className="form-check-label" htmlFor="flag_comment">
                              <span className="badge bg-info me-1">C</span> Comment
                            </label>
                          </div>
                          <div className="form-check">
                            <input
                              type="checkbox"
                              className="form-check-input"
                              id="flag_traffic"
                              checked={participantFlags.flag_traffic}
                              onChange={(e) => setParticipantFlags(prev => ({ ...prev, flag_traffic: e.target.checked }))}
                            />
                            <label className="form-check-label" htmlFor="flag_traffic">
                              <span className="badge bg-warning text-dark me-1">T</span> Traffic
                            </label>
                          </div>
                          <div className="form-check">
                            <input
                              type="checkbox"
                              className="form-check-input"
                              id="flag_echolink"
                              checked={participantFlags.flag_echolink}
                              onChange={(e) => setParticipantFlags(prev => ({ ...prev, flag_echolink: e.target.checked }))}
                            />
                            <label className="form-check-label" htmlFor="flag_echolink">
                              <span className="badge bg-success me-1">E</span> EchoLink
                            </label>
                          </div>
                          <div className="form-check">
                            <input
                              type="checkbox"
                              className="form-check-input"
                              id="flag_announcement"
                              checked={participantFlags.flag_announcement}
                              onChange={(e) => setParticipantFlags(prev => ({ ...prev, flag_announcement: e.target.checked }))}
                            />
                            <label className="form-check-label" htmlFor="flag_announcement">
                              <span className="badge bg-danger me-1">A</span> Announcement
                            </label>
                          </div>
                        </div>
                        <small className="text-muted">Tip: Add /c /t /e /a after call sign to set flags (e.g., W1AW/C/T)</small>
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
                </div>
                {/* Inline Echolink Card */}
                <div className="col-md-4">
                  <div className="card" style={{ maxHeight: '500px', overflow: 'auto' }}>
                    <div className="card-header d-flex justify-content-between align-items-center py-2">
                      <h5 className="mb-0" style={{ fontSize: '0.9rem' }}>
                        <Headphones size={14} className="me-1" />
                        Echolink Stations
                      </h5>
                      <button
                        className="btn btn-sm btn-outline-secondary py-0"
                        onClick={() => queryClient.invalidateQueries('inline-echolink')}
                        disabled={inlineEcholinkFetching}
                      >
                        <RefreshCw size={12} className={inlineEcholinkFetching ? 'animate-spin' : ''} />
                      </button>
                    </div>
                    <div className="card-body p-2">
                      {inlineEcholinkData?.logins?.length > 0 ? (
                        <div className="list-group list-group-flush">
                          {inlineEcholinkData.logins.map((station, idx) => (
                            <div key={idx} className="list-group-item px-2 py-1 d-flex justify-content-between align-items-center" style={{ fontSize: '0.85rem' }}>
                              <div>
                                <strong>{station.callSign}</strong>
                                {station.name && <span className="text-muted ms-1">{station.name}</span>}
                              </div>
                              <button
                                className="btn btn-sm btn-outline-primary py-0 px-1"
                                style={{ fontSize: '0.75rem' }}
                                onClick={() => {
                                  // Submit directly using pre-checkin process logic
                                  addSinglePreCheckInMutation.mutate({
                                    callSign: station.callSign,
                                    firstName: station.name || '',
                                    location: '',
                                    announce: '',
                                    flag_echolink: true
                                  });
                                }}
                              >
                                Add
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted small mb-0 text-center py-2">No echolink stations</p>
                      )}
                    </div>
                  </div>
                </div>
                </div>
              )}

              {/* Participants List */}
              {sessionData.participants && sessionData.participants.length > 0 ? (
                <div>
                  <div className="mb-2">
                    <div className="input-group input-group-sm" style={{ maxWidth: '300px' }}>
                      <span className="input-group-text"><Search size={14} /></span>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Search participants..."
                        value={participantSearch}
                        onChange={(e) => setParticipantSearch(e.target.value)}
                      />
                      {participantSearch && (
                        <button className="btn btn-outline-secondary" onClick={() => setParticipantSearch('')}>
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th width="40">Ack</th>
                        <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleParticipantSort('call_sign')}>
                          Call Sign <SortIndicator field="call_sign" />
                        </th>
                        <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleParticipantSort('name')}>
                          Operator <SortIndicator field="name" />
                        </th>
                        <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleParticipantSort('location')}>
                          Location <SortIndicator field="location" />
                        </th>
                        <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleParticipantSort('check_in_time')}>
                          Check-in <SortIndicator field="check_in_time" />
                        </th>
                        <th>Check-out</th>
                        <th>Flags</th>
                        <th>Notes</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedParticipants.filter(p => {
                        if (!participantSearch) return true;
                        const term = participantSearch.toLowerCase();
                        return (
                          (p.call_sign || '').toLowerCase().includes(term) ||
                          (p.display_name || p.operator_name || p.name || '').toLowerCase().includes(term) ||
                          (p.operator_preferred_name || '').toLowerCase().includes(term) ||
                          (p.display_location || '').toLowerCase().includes(term) ||
                          (p.notes || '').toLowerCase().includes(term)
                        );
                      }).map((participant) => (
                        <tr 
                          key={participant.id}
                          style={{ cursor: 'pointer' }}
                          onClick={(e) => {
                            // Don't trigger edit if clicking on action buttons
                            if (e.target.closest('.btn')) return;
                            handleEditParticipant(participant);
                          }}
                          onMouseEnter={(e) => { const dk = document.documentElement.getAttribute('data-theme') === 'dark'; e.currentTarget.style.backgroundColor = dk ? '#161b22' : '#f8f9fa'; }}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = ''}
                        >
                          <td onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={participant.acknowledged || false}
                              onChange={() => patchParticipantMutation.mutate({
                                participantId: participant.id,
                                data: { acknowledged: !participant.acknowledged }
                              })}
                              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                            />
                          </td>
                          <td>
                            <div className="d-flex align-items-center">
                              <Radio size={16} className="text-primary me-2" />
                              <strong>
                                {participant.display_call_sign || participant.call_sign || participant.operator_call}
                              </strong>
                            </div>
                          </td>
                          <td onClick={(e) => {
                            e.stopPropagation();
                            if (participant.operator_id) {
                              setEditingPreferredName(participant.id);
                              setPreferredNameValue(participant.operator_preferred_name || '');
                            }
                          }}>
                            {editingPreferredName === participant.id ? (
                              <div className="d-flex align-items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="text"
                                  className="form-control form-control-sm"
                                  value={preferredNameValue}
                                  onChange={(e) => setPreferredNameValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      patchParticipantMutation.mutate({ participantId: participant.id, data: { preferred_name: preferredNameValue } });
                                      setEditingPreferredName(null);
                                    }
                                    if (e.key === 'Escape') setEditingPreferredName(null);
                                  }}
                                  onBlur={() => {
                                    patchParticipantMutation.mutate({ participantId: participant.id, data: { preferred_name: preferredNameValue } });
                                    setEditingPreferredName(null);
                                  }}
                                  ref={(el) => { if (el && document.activeElement !== el) { el.focus(); el.select(); } }}
                                  placeholder="Preferred name"
                                  style={{ maxWidth: '120px', backgroundColor: document.documentElement.getAttribute('data-theme') === 'dark' ? '#0d1117' : '#fff', color: document.documentElement.getAttribute('data-theme') === 'dark' ? '#c9d1d9' : '#212529', border: '1px solid #58a6ff' }}
                                />
                              </div>
                            ) : (
                              <div>
                                {participant.operator_preferred_name && (
                                  <div className="d-flex align-items-center">
                                    <User size={14} className="text-primary me-1" />
                                    <strong>{participant.operator_preferred_name}</strong>
                                  </div>
                                )}
                                {(participant.display_name || participant.operator_name) && (
                                  <div className="d-flex align-items-center">
                                    <User size={14} className="text-muted me-1" />
                                    <span className={participant.operator_preferred_name ? 'small text-muted' : ''}>
                                      {participant.display_name || participant.operator_name}
                                    </span>
                                  </div>
                                )}
                                {participant.operator_id && !participant.operator_preferred_name && (
                                  <div className="small text-muted" style={{ cursor: 'pointer', fontStyle: 'italic' }}>click to set preferred name</div>
                                )}
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
                            <div className="d-flex flex-wrap gap-1">
                              {participant.flag_comment && <span className="badge bg-info" title="Comment">C</span>}
                              {participant.flag_traffic && <span className="badge bg-warning text-dark" title="Traffic">T</span>}
                              {participant.flag_echolink && <span className="badge bg-success" title="EchoLink">E</span>}
                              {participant.flag_announcement && <span className="badge bg-danger" title="Announcement">A</span>}
                            </div>
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
                </div>
              ) : (
                <div className="text-center py-4">
                  <Users size={48} className="text-muted mb-3" />
                  <p className="text-muted">No participants recorded yet</p>
                  <button 
                    className="btn btn-primary"
                    onClick={() => {
                      setShowAddParticipant(true);
                      setParticipantFlags({ flag_comment: false, flag_traffic: false, flag_echolink: false, flag_announcement: false });
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
                    <h4>{editingTraffic ? 'Edit Traffic Record' : 'Add Traffic Record'}</h4>
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
                                onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
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
                                onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
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
                          disabled={addTrafficMutation.isLoading || updateTrafficMutation.isLoading}
                        >
                          {(addTrafficMutation.isLoading || updateTrafficMutation.isLoading) ? (
                            <>
                              <Loader size={16} className="animate-spin" />
                              {editingTraffic ? 'Updating...' : 'Adding...'}
                            </>
                          ) : (
                            <>
                              <Send size={16} className="me-2" />
                              {editingTraffic ? 'Update Traffic' : 'Add Traffic'}
                            </>
                          )}
                        </button>
                        <button 
                          type="button" 
                          className="btn btn-secondary"
                          onClick={() => {
                            setShowAddTraffic(false);
                            setEditingTraffic(null);
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
                        <th>Actions</th>
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
                          <td onClick={(e) => e.stopPropagation()}>
                            <div className="d-flex gap-1">
                            <button
                              className="btn btn-sm btn-outline-primary"
                              onClick={() => {
                                setEditingTraffic(traffic);
                                setFromCallSignInput(traffic.from_call || '');
                                setToCallSignInput(traffic.to_call || '');
                                trafficForm.setValue('message_number', traffic.message_number || '');
                                trafficForm.setValue('precedence', traffic.precedence || 'Routine');
                                trafficForm.setValue('message_text', traffic.message_text || '');
                                trafficForm.setValue('time_received', traffic.time_received || '');
                                trafficForm.setValue('handled_by', traffic.handled_by || '');
                                trafficForm.setValue('notes', traffic.notes || '');
                                setShowAddTraffic(true);
                              }}
                            >
                              <Edit size={14} />
                            </button>
                            <button
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => {
                                if (window.confirm('Delete this traffic entry?')) {
                                  deleteTrafficMutation.mutate(traffic.id);
                                }
                              }}
                              disabled={deleteTrafficMutation.isLoading}
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
          <div className="modal-dialog modal-lg" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-content" style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
              <div className="modal-header" style={{ flexShrink: 0 }}>
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
              
              <div className="modal-body" style={{ overflowY: 'auto', flex: 1 }}>
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
                          {[...preCheckInData.participants]
                            .sort((a, b) => {
                              const aIn = sessionData?.participants?.some(p => p.call_sign?.toUpperCase() === a.callSign?.toUpperCase());
                              const bIn = sessionData?.participants?.some(p => p.call_sign?.toUpperCase() === b.callSign?.toUpperCase());
                              if (aIn && !bIn) return 1;
                              if (!aIn && bIn) return -1;
                              return 0;
                            })
                            .map((participant) => {
                            const alreadyInSession = sessionData?.participants?.some(p => 
                              p.call_sign?.toUpperCase() === participant.callSign?.toUpperCase()
                            );
                            return (
                            <tr key={participant.callSign} style={alreadyInSession ? { opacity: 0.5 } : {}}>
                              <td>
                                <input
                                  type="checkbox"
                                  checked={selectedPreCheckIns.has(participant.callSign)}
                                  onChange={(e) => handlePreCheckInSelect(participant, e.target.checked)}
                                  disabled={alreadyInSession}
                                />
                              </td>
                              <td>
                                <div className="d-flex align-items-center">
                                  <Radio size={14} className="text-primary me-2" />
                                  <div>
                                    <strong>{participant.callSign}</strong>
                                    {alreadyInSession && (
                                      <div className="small text-success">
                                        <Check size={10} className="me-1" />
                                        Already in session
                                      </div>
                                    )}
                                    {!alreadyInSession && !participant.hasOperatorRecord && (
                                      <div className="small text-info">
                                        <Search size={10} className="me-1" />
                                        Will lookup QRZ
                                      </div>
                                    )}
                                    {!alreadyInSession && participant.hasOperatorRecord && (
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
                          );
                          })}
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
              
              <div className="modal-footer" style={{ flexShrink: 0 }}>
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