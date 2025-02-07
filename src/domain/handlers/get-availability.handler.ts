import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import {
  ClubWithAvailability,
  GetAvailabilityQuery,
} from '../commands/get-availaiblity.query';
import {
  ALQUILA_TU_CANCHA_CLIENT,
  AlquilaTuCanchaClient,
} from '../ports/aquila-tu-cancha.client';

@QueryHandler(GetAvailabilityQuery)
export class GetAvailabilityHandler
  implements IQueryHandler<GetAvailabilityQuery>
{
  constructor(
    @Inject(ALQUILA_TU_CANCHA_CLIENT)
    private alquilaTuCanchaClient: AlquilaTuCanchaClient,

    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async execute(query: GetAvailabilityQuery): Promise<ClubWithAvailability[]> {


    const placeAvailityCached = await this.cacheManager.get(query.placeId);
    if (placeAvailityCached) {
      return placeAvailityCached
    }
    


    const clubs_with_availability: ClubWithAvailability[] = [];
    const clubs = await this.alquilaTuCanchaClient.getClubs(query.placeId);
    
    //Se refactoriza el sistema para usar Promise.All y procesar los clubes juntos
    const promisesClubs = clubs.map(async (club) => {

      const courts = await this.alquilaTuCanchaClient.getCourts(club.id);

      const courtsPromises = courts.map(async (court) => {
      
        const slots = await this.alquilaTuCanchaClient.getAvailableSlots(
          club.id,
          court.id,
          query.date,
        );

        return {...court, available: slots}
    });
    
    //Se esperan que se terminen las promesas
    const courtsWithAvailability = await Promise.all(courtsPromises);
          return {
        ...club,
        courts: courtsWithAvailability,
      };
    });

    const data = (await Promise.all(promisesClubs)).filter(
      (club): club is ClubWithAvailability => club !== null,
    );

    this.cacheManager.set(query.placeId, data, 1000 * 10);

    return data;
}
}
