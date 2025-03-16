import { DependencyContainer } from "tsyringe";

import { ILogger } from "@spt/models/spt/utils/ILogger";
import { IPostDBLoadMod } from "@spt/models/external/IPostDBLoadMod";
import { DatabaseServer } from "@spt/servers/DatabaseServer";
import { SaveServer } from "@spt/servers/SaveServer";
import { WishlistController } from "@spt/controllers/WishlistController";
import { IPostSptLoadMod } from "@spt/models/external/IPostSptLoadMod";
import { ITemplateItem } from "@spt/models/eft/common/tables/ITemplateItem";
import { ItemBaseClassService } from "@spt/services/ItemBaseClassService";
import { BaseClasses } from "@spt/models/enums/BaseClasses";

class Mod implements IPostDBLoadMod, IPostSptLoadMod 
{
    private mod: string;
    private nonFleableItems: ITemplateItem[];

    constructor() 
    {
        this.mod = "WishlistNonFleableItems";
    }

    public postDBLoad(container: DependencyContainer): void 
    {
        const logger = container.resolve<ILogger>("WinstonLogger");
        const databaseServer = container.resolve<DatabaseServer>("DatabaseServer");
        const itemBaseClassService = container.resolve<ItemBaseClassService>("ItemBaseClassService");

        const database = databaseServer.getTables();

        if (!database?.templates?.items) 
        {
            logger.error(`[${this.mod}] Failed to access item database`);
            return;
        }

        const items: Record<string, ITemplateItem> = database.templates.items;

        const targetBaseClasses = new Set([
            BaseClasses.AMMO,
            BaseClasses.KEY
        ]);

        // Filter items that can't be sold on the flea market
        this.nonFleableItems = Object.values(items).filter(item =>
        {
            if (!item._props.CanSellOnRagfair)
            {
                // Get the base classes of the item
                const itemBaseClasses = itemBaseClassService.getItemBaseClasses(item._id);

                // Check if any of the item's base classes match our target set
                return itemBaseClasses.some(baseClass => targetBaseClasses.has(baseClass as BaseClasses));
            }
            return false;
        });

        logger.info(`[${this.mod}] Found ${this.nonFleableItems.length} non-flea items matching target base classes.`);
    }

    public postSptLoad(container: DependencyContainer): void 
    {
        const logger = container.resolve<ILogger>("WinstonLogger");
        const saveServer = container.resolve<SaveServer>("SaveServer");
        const wishlistController = container.resolve<WishlistController>("WishlistController");

        for (const sessionID in saveServer.getProfiles()) 
        {
            logger.info(`[${this.mod}] Adding ${this.nonFleableItems.length} non-flea items to wishlist for ${sessionID}`);
            const pmcData = saveServer.getProfile(sessionID).characters.pmc;

            const itemsToAdd: Record<string, number> = this.nonFleableItems.reduce((acc, item) => 
            {
                acc[item._id] = 4;
                return acc;
            }, {});

            wishlistController.addToWishList(pmcData, { Action: "Add", items: itemsToAdd }, sessionID);
        }
    }
}

export const mod = new Mod();
