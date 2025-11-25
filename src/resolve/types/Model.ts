import {Model as TSP_Model} from '@typespec/compiler';
import {Resolvable} from '../Resolvable.js';
import {Resolver, ResolverOptions, ResolverResult} from '../resolve.js';
import {IndexedModel} from './Model.Indexed.js';
import {ShapedModel} from './Model.Shaped.js';

export class ResolvableModel extends Resolvable<TSP_Model> {
  constructor(t: TSP_Model, r: Resolver) {
    super(t, r);
    switch ((t as TSP_Model).name) {
      case "Array":
      case "Record":
        this.actual = new IndexedModel(t, r);
        break;
    
      default:
        this.actual = new ShapedModel(t, r);
        break;
    }
  }

  protected expectedTypeKind: string = "Model";

  private actual: Resolvable<TSP_Model>;

  protected async type(opts: ResolverOptions<Resolver.Type>, out: ResolverResult<Resolver.Type>): Promise<void> {
    await this.actual.resolve(opts, out);
  }
  
  protected async typeguard(opts: ResolverOptions<Resolver.Typeguard>, out: ResolverResult<Resolver.Typeguard>): Promise<void> {
    await this.actual.resolve(opts, out);
  }
}