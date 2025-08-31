import {toast} from "react-toastify"
import api from "../../../axios";
import type { Province } from "../../types.ts";

export function findAllProvinces(): Promise<Province[]> {
    return api.get('/provinces')
        .then(response => response.data.data)
        .catch(err => {
            toast.error(`Error al obtener provincias: ${err.message}`);
            return [];
        });
}

export function findAllActiveProvinces(): Promise<Province[]>{
  return api.get('provinces/active')
    .then(response => response.data.data)
    .catch(err => {
      toast.error(`Error al obtener provincias activas: ${err.message}`);
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
        // añadimos la provincia nueva al array
        toast.success(`Provincia creada!`);
        return created.data.data;
      })
      .catch(err => {
        toast.error(`Error al crear provincia: ${err.message}`);
        throw new Error();
        });
      }

export function removeProvince(id: string) : Promise<boolean> {
    if (!id) return Promise.resolve(false);

    return api.patch(`/provinces/${id}/toggle-state`)
      .then(() => {
        toast.success(`Provincia eliminada!`);
        return true;
      })
      .catch(err => {
        toast.error(`Error al eliminar provincia: ${err.message}`);
        return false;
      });
  }

export function updateProvince(id: string, newName: string, active: boolean) : Promise<Province | void | undefined> {
    if (!newName) return Promise.resolve(undefined);

    if(active) {
      return api.put(`/provinces/${id}`, {
        nameProvince: newName
      })
      .then(updated => {
        toast.success(`Provincia modificada!`);
        return updated.data.data;
      })
      .catch(err => {
        toast.error(`Error al modificar provincia: ${err.message}`);
        });

      } else {

      return api.patch(`/provinces/${id}/toggle-state`)
      .then(() => {
        toast.success(`Provincia activada!`);
      })
      .catch(err => {
        toast.error(`Error al modificar provincia: ${err.message}`);
      });
    }; 
  }