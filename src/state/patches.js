import { createSlice } from '@reduxjs/toolkit';

export const patchesSlice = createSlice({
  name: 'patches',
  initialState: {
    // confirmed selection: array of patch ids in load order; empty array = no patches selected
    confirmed: [],
    // temp selection for UI dialogs: { ids: [], order: [] }
    temp: null,
  },
  reducers: {
    setConfirmed: (state, { payload }) => ({ ...state, confirmed: payload || [] }),
    beginTemp: (state, { payload }) => ({ ...state, temp: payload || { ids: [], order: [] } }),
    updateTemp: (state, { payload }) => ({ ...state, temp: { ...state.temp, ...payload } }),
    clearTemp: (state) => ({ ...state, temp: null }),
  },
});

export const { setConfirmed, beginTemp, updateTemp, clearTemp } = patchesSlice.actions;

export default patchesSlice.reducer;
