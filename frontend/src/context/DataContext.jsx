import React, { createContext, useState, useContext } from 'react';

const DataContext = createContext();

export const DataProvider = ({ children }) => {
  const [analyzedData, setAnalyzedData] = useState(null);
  const [loading, setLoading] = useState(false);

  return (
    <DataContext.Provider value={{ analyzedData, setAnalyzedData, loading, setLoading }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => useContext(DataContext);
