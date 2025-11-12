import api from "../../../axios";
import type { Province } from "../../types.ts";

export function findAllProvinces(): Promise<Province[]> {
    return api.get('/provinces')
        .then(response => response.data.data)
        .catch(() => {
            return [];
        });
}

export function findAllActiveProvinces(): Promise<Province[]>{
  return api.get('provinces/active')
    .then(response => response.data.data)
    .catch(() => {
      return [];
    });
}

export function createProvince(nameProvince: string) : Promise<Province | undefined> {

    if (!nameProvince.trim()) return Promise.resolve(undefined);

      return api.post('/provinces', {
          nameProvince: nameProvince,
          active: true
      })
      .then(created => {
        return created.data.data;
      })
      .catch(err => {
        const backendMsg = err.response?.data?.message || err.message;
        throw new Error(backendMsg);
        });
      }

export function removeProvince(id: string) : Promise<boolean> {
    if (!id) return Promise.resolve(false);

    return api.patch(`/provinces/${id}/toggle-state`)
      .then(() => {
        return true;
      })
      .catch(err => {
        const backendMsg = err.response?.data?.message || err.message;
        throw new Error(backendMsg);
      });
  }

export function updateProvince(id: string, newName: string, active: boolean) : Promise<Province | void | undefined> {
    if (!newName) return Promise.resolve(undefined);

    if(active) {
      return api.put(`/provinces/${id}`, {
        nameProvince: newName
      })
      .then(updated => {
        return updated.data.data;
      })
      .catch(err => {
        const backendMsg = err.response?.data?.message || err.message;
        throw new Error(backendMsg);
        });

      } else {

      return api.patch(`/provinces/${id}/toggle-state`)
      .then(() => {
        return;
      })
      .catch(err => {
        const backendMsg = err.response?.data?.message || err.message;
        throw new Error(backendMsg);
      });
    }; 
  }