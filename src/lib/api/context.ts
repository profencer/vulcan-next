/**
 * Context creation, for graphql but also REST endpoints
 */
import { VulcanGraphqlModel } from "@vulcanjs/graphql/server";
import { Connector } from "@vulcanjs/crud/server";

import { createMongooseConnector } from "@vulcanjs/mongo";
import { User, UserConnector, UserType } from "~/models/user.server";
import { NextApiRequest } from "next";
import { getSession } from "~/lib/api/account";
import { Request } from "express";
import debug from "debug";
import models from "~/models/index.server";
import { VulcanGraphqlModelServer } from "@vulcanjs/graphql";
const debugGraphqlContext = debug("vn:graphql:context");

/**
const models = [Tweek, Twaik];
 * Expected shape of the context
 * {
 *    "Foo": {
 *      model: Foo,
 *      connector: FooConnector
 *    }
 * }
 */
interface ModelContext {
  [typeName: string]: { model: VulcanGraphqlModel; connector: Connector };
}
/**
 * Build a default graphql context for a list of models
 *
 * Will use Mongoose connector if no connector is specified in the model
 * @param models
 */
const createContextForModels = (
  models: Array<VulcanGraphqlModelServer>
): ModelContext => {
  return models.reduce(
    (context, model) => ({
      ...context,
      [model.name]: {
        model,
        connector: model.graphql.connector || createMongooseConnector(model),
      },
    }),
    {}
  );
};

// TODO: isolate context creation code like we do in Vulcan + initialize the currentUser too
export const contextBase = {
  ...createContextForModels(models),
  // add some custom context here if needed
};

interface UserContext {
  userId?: string;
  currentUser?: UserType;
}
const userContextFromReq = async (
  req: Request | NextApiRequest
): Promise<UserContext> => {
  const session = await getSession(req);
  if (!session?._id) return {};
  // Refetch the user from db in order to get the freshest data
  const user = await UserConnector.findOneById(session._id);
  if (user) {
    return { userId: user._id, currentUser: user };
  }
  return {};
};
export const contextFromReq = async (req: Request) => {
  // TODO
  const userContext = await userContextFromReq(req);
  const context = {
    ...contextBase,
    ...userContext,
    // pass down the request to graphql context, to allow advanced usage
    req,
  };
  debugGraphqlContext("Graphql context for current request:", context);
  return context;
};
