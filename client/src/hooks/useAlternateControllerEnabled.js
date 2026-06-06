import { useQuery } from 'react-query';
import axios from 'axios';

const useAlternateControllerEnabled = () => {
  const { data, isLoading } = useQuery(
    'alternate-controller-enabled',
    () => axios.get('/api/alternate-controller/status').then(r => r.data.enabled),
    { staleTime: 60000 }
  );
  return { enabled: data ?? false, isLoading };
};

export default useAlternateControllerEnabled;
